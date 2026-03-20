import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_MAX_POOL_SIZE = Number(process.env.MONGODB_MAX_POOL_SIZE ?? 100);
const MONGODB_MIN_POOL_SIZE = Number(process.env.MONGODB_MIN_POOL_SIZE ?? 10);

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable in .env.local");
}

let cached = global.mongoClient;
let indexesReady = global.mongoIndexesReady;

if (!cached) {
  cached = global.mongoClient = { conn: null, promise: null };
}

if (!indexesReady) {
  indexesReady = global.mongoIndexesReady = { promise: null };
}

async function ensureIndexes(db) {
  if (!indexesReady.promise) {
    indexesReady.promise = Promise.all([
      db.collection("users").createIndex({ email: 1 }, { unique: true, name: "unique_user_email" }),
      db.collection("predictionhistories").createIndex({ userId: 1, date: -1 }, { name: "history_user_date" }),
      db.collection("predictionhistories").createIndex({ createdAt: -1 }, { name: "history_created_at" }),
    ]);
  }

  await indexesReady.promise;
}

async function connectToDatabase() {
  if (cached.conn) {
    await ensureIndexes(cached.conn);
    return cached.conn;
  }

  if (!cached.promise) {
    const client = new MongoClient(MONGODB_URI, {
      maxPoolSize: Number.isFinite(MONGODB_MAX_POOL_SIZE) ? MONGODB_MAX_POOL_SIZE : 100,
      minPoolSize: Number.isFinite(MONGODB_MIN_POOL_SIZE) ? MONGODB_MIN_POOL_SIZE : 10,
      maxIdleTimeMS: 60000,
      retryWrites: true,
    });
    cached.promise = client.connect().then((connectedClient) => connectedClient.db());
  }

  cached.conn = await cached.promise;
  await ensureIndexes(cached.conn);
  return cached.conn;
}

export default connectToDatabase;
