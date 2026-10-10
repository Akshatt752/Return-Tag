import crypto from "node:crypto";

// AES-256-GCM for data we must read back later (finder email, finder link).
// Stored as "v1:<iv>:<authTag>:<ciphertext>", all base64url.
export function encrypt(plainText) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${authTag.toString("base64url")}:${data.toString("base64url")}`;
}

export function decrypt(payload) {
  const [version, iv, authTag, data] = String(payload).split(":");
  if (version !== "v1") throw new Error("Unknown encryption format");
  const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(authTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

// Keyed hash for low-entropy values (IP addresses, 8-char claim codes) so a leaked
// database can't be brute-forced back to the originals without HASH_SECRET
export function hmac(value) {
  return crypto.createHmac("sha256", process.env.HASH_SECRET).update(String(value)).digest("hex");
}

// High-entropy bearer secrets (finder links, transfer links): only the SHA-256 is stored
export const randomToken = () => crypto.randomBytes(32).toString("base64url");
export const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");

export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
