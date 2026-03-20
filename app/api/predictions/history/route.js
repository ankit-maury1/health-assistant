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

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Unauthenticated" }), { status: 401 });
  }

  try {
    await readLimiter.check(90, session.user.email);
  } catch {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), { status: 429 });
  }

  const db = await connectToDatabase();
  const users = db.collection("users");
  const predictionHistory = db.collection("predictionhistories");

  const { searchParams } = new URL(req.url);
  const requestedLimit = Number(searchParams.get("limit") || 50);
  const safeLimit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.floor(requestedLimit)))
    : 50;

  const user = await users.findOne({ email: session.user.email });
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
  }

  const history = await predictionHistory
    .find({ userId: user._id })
    .sort({ date: -1 })
    .limit(safeLimit)
    .toArray();

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

    return {
      ...rest,
      inputMetrics,
      result,
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

  return new Response(JSON.stringify({ history: decryptedHistory, baseline }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Unauthenticated" }), { status: 401 });
  }

  try {
    await writeLimiter.check(40, getClientToken(req, session.user.email));
  } catch {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), { status: 429 });
  }

  const body = await req.json();
  const { inputMetrics, riskScore, riskLevel, date, condition } = body;

  if (!inputMetrics || typeof riskScore !== "number" || !riskLevel) {
    return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
  }

  const finalCondition = condition || "general";
  if (!["diabetes", "heart-disease", "general"].includes(finalCondition)) {
    return new Response(JSON.stringify({ error: "Invalid condition" }), { status: 400 });
  }

  const db = await connectToDatabase();
  const users = db.collection("users");
  const predictionHistory = db.collection("predictionhistories");

  const user = await users.findOne({ email: session.user.email });
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
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

  return new Response(JSON.stringify({ success: true, entry: { ...entryDoc, _id: entry.insertedId, inputMetrics } }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}
