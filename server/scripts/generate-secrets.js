// Prints fresh values for the secret variables in .env
// Usage: npm run generate-secrets
import crypto from "node:crypto";
import webpush from "web-push";

const vapid = webpush.generateVAPIDKeys();

console.log(`JWT_SECRET=${crypto.randomBytes(48).toString("hex")}`);
console.log(`ENCRYPTION_KEY=${crypto.randomBytes(32).toString("hex")}`);
console.log(`HASH_SECRET=${crypto.randomBytes(32).toString("hex")}`);
console.log(`VAPID_PUBLIC_KEY=${vapid.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapid.privateKey}`);
