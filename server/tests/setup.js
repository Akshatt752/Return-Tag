// Shared test harness: in-memory MongoDB + helpers. Env must be set before app modules load.
import crypto from "node:crypto";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString("hex");
process.env.HASH_SECRET = "test-hash-secret";
process.env.PUBLIC_APP_URL = "https://returntag.test";
process.env.FREE_TAG_LIMIT = "3";
delete process.env.TURNSTILE_SECRET_KEY;

const { MongoMemoryServer } = await import("mongodb-memory-server");
const mongoose = (await import("mongoose")).default;
const request = (await import("supertest")).default;
const app = (await import("../src/app.js")).default;

let mongod;
export async function startDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}
export async function stopDb() {
  await mongoose.disconnect();
  await mongod?.stop();
}

export const api = () => request(app);

let counter = 0;
// Each test file runs in its own process, so a unique IP per user/finder keeps rate limiters apart
export const nextIp = () => `10.0.${Math.floor(counter / 250)}.${(counter++ % 250) + 1}`;

export async function registerUser(name = "Owner") {
  const email = `${name.toLowerCase().replace(/\W/g, "")}-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const res = await api()
    .post("/api/auth/register")
    .set("X-Forwarded-For", nextIp())
    .send({ name, email, password: "password123" });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user, email, auth: { Authorization: `Bearer ${res.body.token}` } };
}

export const TAG_BODY = {
  item: { name: "MacBook Pro 14", category: "laptop", description: "Serial C02XYZ, sticker on lid" },
  publicLabel: "Silver laptop",
  publicMessage: "Thank you! Any library desk is fine.",
  rewardOffered: true,
};

export async function createTag(owner, body = TAG_BODY) {
  const res = await api().post("/api/tags").set(owner.auth).send(body);
  if (res.status !== 201) throw new Error(`create tag failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.tag;
}

export function submitReport(code, fields = {}, ip = nextIp()) {
  return api()
    .post(`/api/public/tags/${code}/reports`)
    .set("X-Forwarded-For", ip)
    .send({ message: "Found it on a bench near gate 4", elapsedMs: 8000, ...fields });
}

export const finder = (reportId, token) => ({
  get: () => api().get(`/api/public/reports/${reportId}`).set("X-Finder-Token", token),
  send: (body) => api().post(`/api/public/reports/${reportId}/messages`).set("X-Finder-Token", token).send({ body }),
});
