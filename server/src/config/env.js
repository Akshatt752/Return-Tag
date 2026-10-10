// Imported first in index.js so every other module sees the variables from .env
import dotenv from "dotenv";

dotenv.config({ quiet: true });

const required = ["MONGO_URI", "JWT_SECRET", "ENCRYPTION_KEY", "HASH_SECRET"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(
    `Missing environment variables: ${missing.join(", ")}. Copy .env.example to .env and run "npm run generate-secrets".`
  );
  process.exit(1);
}

if (!/^[0-9a-f]{64}$/i.test(process.env.ENCRYPTION_KEY)) {
  console.error("ENCRYPTION_KEY must be 64 hex characters (32 bytes). Run \"npm run generate-secrets\".");
  process.exit(1);
}

if (!process.env.PUBLIC_APP_URL) {
  console.warn("PUBLIC_APP_URL not set: QR codes will point at the first CLIENT_URL.");
}
if (!process.env.SMTP_HOST) {
  console.warn("SMTP_HOST not set: emails will be printed to this console instead of sent.");
}
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.warn("VAPID keys not set: push notifications are disabled.");
}
