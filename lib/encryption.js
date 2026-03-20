import crypto from "crypto";

const AES_ALGORITHM = "aes-256-cbc";
const KEY = process.env.ENCRYPTION_KEY;

if (!KEY || KEY.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be set and 32 characters long (256-bit) in .env.local");
}

const KEY_BUFFER = Buffer.from(KEY, "utf8");

export function encryptHealthData(plaintext) {
  if (typeof plaintext !== "string") {
    plaintext = JSON.stringify(plaintext);
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(AES_ALGORITHM, KEY_BUFFER, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  return `${iv.toString("base64")}:${encrypted}`;
}

export function decryptHealthData(payload) {
  if (!payload || typeof payload !== "string" || !payload.includes(":")) {
    throw new Error("Invalid encrypted health payload");
  }

  const [ivBase64, encryptedData] = payload.split(":");
  const iv = Buffer.from(ivBase64, "base64");
  const decipher = crypto.createDecipheriv(AES_ALGORITHM, KEY_BUFFER, iv);

  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");

  try {
    return JSON.parse(decrypted);
  } catch {
    return decrypted;
  }
}
