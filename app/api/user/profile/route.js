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
    await readLimiter.check(120, getClientToken(req, session.user.email));
  } catch {
    return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), { status: 429 });
  }

  const db = await connectToDatabase();
  const users = db.collection("users");
  let user = await users.findOne({ email: session.user.email });

  if (!user) {
    // If the user exists in next-auth session but not in our DB yet,
    // seed the user without health data and continue to avoid 404s.
    const now = new Date();
    const insertResult = await users.insertOne({
      email: session.user.email,
      createdAt: now,
      updatedAt: now,
      encryptedHealthData: null,
    });
    user = await users.findOne({ _id: insertResult.insertedId });
  }

  let healthData = null;
  if (user.encryptedHealthData) {
    try {
      healthData = decryptHealthData(user.encryptedHealthData);
    } catch (error) {
      console.error("decrypt user health", error);
      healthData = null;
    }
  }

  return new Response(JSON.stringify({
    email: user.email,
    healthData,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function PATCH(req) {
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
  const { healthData } = body;

  if (!healthData || typeof healthData !== "object") {
    return new Response(JSON.stringify({ error: "Invalid healthData" }), { status: 400 });
  }

  const encrypted = encryptHealthData(healthData);

  const db = await connectToDatabase();
  const users = db.collection("users");
  const updateResult = await users.updateOne(
    { email: session.user.email },
    { $set: { encryptedHealthData: encrypted, updatedAt: new Date() } }
  );

  if (updateResult.matchedCount === 0) {
    return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
