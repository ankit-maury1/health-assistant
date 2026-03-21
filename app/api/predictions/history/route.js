import { getServerSession } from "next-auth/next";
import connectToDatabase from "@/lib/mongodb";
import { decryptHealthData, encryptHealthData } from "@/lib/encryption";
import authOptions from "@/lib/authOptions";
import rateLimit from "@/lib/rate-limit";

const readLimiter = rateLimit({ interval: 60 * 1000 });
const writeLimiter = rateLimit({ interval: 60 * 1000 });

function getClientToken(req, userEmail = "") {
  const forwarded = req.headers.get("x-forwarded-for") || "unknown";
  const ip = forwarded.split(",")[0].trim();
  return userEmail ? `${ip}:${userEmail}` : ip;
}

function normalizeCondition(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "heart disease" || raw === "heart-disease")
    return "heart-disease";
  if (raw === "diabetes") return "diabetes";
  return "general";
}

function normalizeRiskScore(entry) {
  const candidate =
    entry.riskScore ??
    entry.result?.probability ??
    entry.result?.advice?.score ??
    null;
  const numeric = Number(candidate);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeRiskLevel(entry, riskScore) {
  const fromEntry =
    entry.riskLevel ??
    entry.result?.advice?.risk_level ??
    entry.result?.riskLevel;
  if (fromEntry) return String(fromEntry);
  if (!Number.isFinite(riskScore)) return null;
  if (riskScore >= 70) return "High Risk";
  if (riskScore >= 40) return "Moderate Risk";
  return "Low Risk";
}

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Unauthenticated" }), {
      status: 401,
    });
  }

  try {
    await readLimiter.check(90, session.user.email);
  } catch {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again shortly." }),
      { status: 429 },
    );
  }

  const db = await connectToDatabase();
  const users = db.collection("users");
  const predictionHistory = db.collection("predictionhistories");

  const { searchParams } = new URL(req.url);
  const requestedLimit = Number(searchParams.get("limit") || 200);
  const requestedSkip = Number(searchParams.get("skip") || 0);
  const viewMode = (searchParams.get("view") || "history").toLowerCase();
  const windowDays = Number(
    searchParams.get("windowDays") || (viewMode === "dashboard" ? 30 : 0),
  );
  const safeLimit = Number.isFinite(requestedLimit)
    ? Math.min(1000, Math.max(1, Math.floor(requestedLimit)))
    : 200;
  const safeSkip = Number.isFinite(requestedSkip)
    ? Math.max(0, Math.floor(requestedSkip))
    : 0;
  const safeWindow = Number.isFinite(windowDays)
    ? Math.max(0, Math.floor(windowDays))
    : 0;

  let user = await users.findOne({ email: session.user.email });
  if (!user) {
    const now = new Date();
    const insertResult = await users.insertOne({
      email: session.user.email,
      createdAt: now,
      updatedAt: now,
      encryptedHealthData: null,
    });
    user = await users.findOne({ _id: insertResult.insertedId });
  }

  const queryFilter = { userId: user._id };
  if (safeWindow > 0) {
    queryFilter.date = {
      $gte: new Date(Date.now() - safeWindow * 24 * 60 * 60 * 1000),
    };
  }

  const query = predictionHistory.find(queryFilter).sort({ date: -1 });

  const total = await predictionHistory.countDocuments(queryFilter);

  const history =
    viewMode === "dashboard"
      ? await query.limit(safeLimit).toArray()
      : await query.skip(safeSkip).limit(safeLimit).toArray();

  const decryptedHistory = history.map((entry) => {
    const { encryptedInputMetrics, encryptedResult, ...rest } = entry;

    let inputMetrics = rest.inputMetrics ?? null;
    let result = rest.result ?? null;

    if (encryptedInputMetrics) {
      try {
        inputMetrics = decryptHealthData(encryptedInputMetrics);
      } catch (error) {
        console.error("decrypt history inputMetrics", error);
      }
    }

    if (encryptedResult) {
      try {
        result = decryptHealthData(encryptedResult);
      } catch (error) {
        console.error("decrypt history result", error);
      }
    }

    const merged = {
      ...rest,
      inputMetrics,
      result,
    };

    const normalizedRiskScore = normalizeRiskScore(merged);
    const normalizedRiskLevel = normalizeRiskLevel(merged, normalizedRiskScore);
    const normalizedCondition = normalizeCondition(
      merged.condition ?? merged.result?.condition,
    );

    return {
      ...merged,
      condition: normalizedCondition,
      riskScore: Number.isFinite(normalizedRiskScore)
        ? normalizedRiskScore
        : (merged.riskScore ?? null),
      riskLevel: normalizedRiskLevel ?? merged.riskLevel ?? null,
    };
  });

  let baseline = null;
  if (user.encryptedHealthData) {
    try {
      baseline = decryptHealthData(user.encryptedHealthData);
    } catch (err) {
      console.error("decrypt baseline", err);
      baseline = null;
    }
  }

  const hasMore =
    viewMode === "dashboard"
      ? false
      : safeSkip + decryptedHistory.length < total;

  return new Response(
    JSON.stringify({
      history: decryptedHistory,
      baseline,
      hasMore,
      total,
      limit: safeLimit,
      skip: safeSkip,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Unauthenticated" }), {
      status: 401,
    });
  }

  try {
    await writeLimiter.check(40, getClientToken(req, session.user.email));
  } catch {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again shortly." }),
      { status: 429 },
    );
  }

  const body = await req.json();
  const { inputMetrics, riskScore, riskLevel, date, condition } = body;

  if (!inputMetrics || typeof riskScore !== "number" || !riskLevel) {
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
    });
  }

  const finalCondition = condition || "general";
  if (!["diabetes", "heart-disease", "general"].includes(finalCondition)) {
    return new Response(JSON.stringify({ error: "Invalid condition" }), {
      status: 400,
    });
  }

  const db = await connectToDatabase();
  const users = db.collection("users");
  const predictionHistory = db.collection("predictionhistories");

  let user = await users.findOne({ email: session.user.email });
  if (!user) {
    const now = new Date();
    const insertResult = await users.insertOne({
      email: session.user.email,
      createdAt: now,
      updatedAt: now,
      encryptedHealthData: null,
    });
    user = await users.findOne({ _id: insertResult.insertedId });
  }

  const entryDoc = {
    userId: user._id,
    date: date ? new Date(date) : new Date(),
    encryptedInputMetrics: encryptHealthData(inputMetrics),
    riskScore,
    riskLevel,
    condition: finalCondition,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const entry = await predictionHistory.insertOne(entryDoc);

  return new Response(
    JSON.stringify({
      success: true,
      entry: { ...entryDoc, _id: entry.insertedId, inputMetrics },
    }),
    {
      status: 201,
      headers: { "Content-Type": "application/json" },
    },
  );
}
