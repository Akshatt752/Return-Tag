import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import Report from "../src/models/Report.js";
import { api, createTag, finder, nextIp, registerUser, startDb, stopDb, submitReport } from "./setup.js";

before(startDb);
after(stopDb);

const SECRET_FIELDS = ["finderTokenHash", "finderEmailEnc", "finderTokenEnc", "ipHash", "owner", "email"];

function assertNoSecrets(body) {
  const json = JSON.stringify(body);
  // Match JSON keys only: "owner" is also a legitimate value of message.sender
  for (const field of SECRET_FIELDS) assert.ok(!json.includes(`"${field}":`), `response leaked ${field}`);
}

describe("public tag page", () => {
  test("shows only public fields and counts scans", async () => {
    const owner = await registerUser("Private Person");
    const tag = await createTag(owner);

    // Lowercase with a dash, as someone might type it from the sticker
    const typed = `${tag.code.slice(0, 5)}-${tag.code.slice(5)}`.toLowerCase();
    const res = await api().get(`/api/public/tags/${typed}`);
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body.tag).sort(), [
      "acceptingReports",
      "category",
      "code",
      "publicLabel",
      "publicMessage",
      "rewardOffered",
      "state",
    ]);
    const json = JSON.stringify(res.body);
    assert.ok(!json.includes(owner.email) && !json.includes("Private Person") && !json.includes("C02XYZ"));

    const mine = await api().get(`/api/tags/${tag.id}`).set(owner.auth);
    assert.equal(mine.body.tag.scanCount, 1);
  });

  test("unknown codes are 404", async () => {
    assert.equal((await api().get("/api/public/tags/ZZZZZZZZZZ")).status, 404);
    assert.equal((await api().get("/api/public/tags/short")).status, 404);
  });
});

describe("finder report and anonymous chat", () => {
  test("full conversation without either side seeing contact details", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);

    const created = await submitReport(tag.code, {
      alias: "Kind stranger",
      email: "finder@example.com",
      locationText: "Front desk, Central Library",
      lat: 28.613939,
      lng: 77.209023,
      message: "Found it at the library. Details: https://evil.example/phish",
    });
    assert.equal(created.status, 201);
    const { reportId, token, finderUrl } = created.body;
    assert.equal(finderUrl, `https://returntag.test/r/${reportId}#${token}`);

    // Tag flipped to found and the owner has an unread report
    const tagView = await api().get(`/api/tags/${tag.id}`).set(owner.auth);
    assert.equal(tagView.body.tag.status, "found");
    assert.equal(tagView.body.tag.unread, 1);

    const inbox = await api().get("/api/reports").set(owner.auth);
    assert.equal(inbox.body.reports.length, 1);
    assert.equal(inbox.body.reports[0].alias, "Kind stranger");
    assertNoSecrets(inbox.body);

    const detail = await api().get(`/api/reports/${reportId}`).set(owner.auth);
    assertNoSecrets(detail.body);
    assert.ok(!JSON.stringify(detail.body).includes("finder@example.com"), "finder email never reaches the owner");
    assert.deepEqual(detail.body.report.location, {
      text: "Front desk, Central Library",
      lat: 28.614, // rounded to ~110 m by default
      lng: 77.209,
      precision: "approx",
    });
    assert.equal(detail.body.messages[0].body, "Found it at the library. Details: [link removed]");

    // Owner replies, finder reads it with their token
    const reply = await api().post(`/api/reports/${reportId}/messages`).set(owner.auth).send({ body: "Thank you so much!" });
    assert.equal(reply.status, 201);

    const finderView = await finder(reportId, token).get();
    assert.equal(finderView.status, 200);
    assert.deepEqual(
      finderView.body.messages.map((m) => m.sender),
      ["finder", "owner"]
    );
    assert.equal(finderView.body.report.tag.publicLabel, "Silver laptop");
    assertNoSecrets(finderView.body);
    assert.ok(!JSON.stringify(finderView.body).includes(owner.email));

    const finderReply = await finder(reportId, token).send("I'll leave it with the librarian");
    assert.equal(finderReply.status, 201);

    // Email is stored encrypted, not in plain text
    const stored = await Report.findById(reportId).select("+finderEmailEnc +finderTokenHash");
    assert.ok(stored.finderEmailEnc.startsWith("v1:") && !stored.finderEmailEnc.includes("finder@"));
    assert.notEqual(stored.finderTokenHash, token);

    // Owner marks returned: incident recovered, conversation closed with a system message
    const done = await api().patch(`/api/reports/${reportId}`).set(owner.auth).send({ action: "returned" });
    assert.equal(done.body.report.status, "resolved");
    assert.equal(done.body.tag.status, "returned");
    const closed = await finder(reportId, token).get();
    assert.equal(closed.body.messages.at(-1).sender, "system");
    assert.equal((await finder(reportId, token).send("hello?")).status, 409);
  });

  test("wrong or missing finder token looks like a missing report", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);
    const { reportId } = (await submitReport(tag.code)).body;
    assert.equal((await finder(reportId, "x".repeat(43)).get()).status, 404);
    assert.equal((await api().get(`/api/public/reports/${reportId}`)).status, 404);
  });

  test("exact location keeps more precision when the finder chooses it", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);
    const { reportId } = (await submitReport(tag.code, { lat: 51.5007292, lng: -0.1246254, precision: "exact" })).body;
    const detail = await api().get(`/api/reports/${reportId}`).set(owner.auth);
    assert.equal(detail.body.report.location.lat, 51.50073);
    assert.equal(detail.body.report.location.precision, "exact");
  });

  test("photo upload strips EXIF and GPS metadata", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);
    const original = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#c33" } })
      .jpeg()
      .withExif({ IFD0: { Make: "SecretPhone", Artist: "Finder Name" } })
      .toBuffer();
    assert.ok((await sharp(original).metadata()).exif, "fixture has EXIF");

    const res = await api()
      .post(`/api/public/tags/${tag.code}/reports`)
      .set("X-Forwarded-For", nextIp())
      .field("message", "Photo of where I left it")
      .field("elapsedMs", "9000")
      .attach("photo", original, { filename: "found.jpg", contentType: "image/jpeg" });
    assert.equal(res.status, 201);

    const photo = await api()
      .get(`/api/reports/${res.body.reportId}/photo`)
      .set(owner.auth)
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    assert.equal(photo.status, 200);
    assert.equal(photo.headers["content-type"], "image/jpeg");
    const meta = await sharp(photo.body).metadata();
    assert.equal(meta.exif, undefined);
    assert.ok(!photo.body.includes(Buffer.from("SecretPhone")));
  });

  test("rejects non-image uploads", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);
    const res = await api()
      .post(`/api/public/tags/${tag.code}/reports`)
      .set("X-Forwarded-For", nextIp())
      .field("message", "See attached")
      .field("elapsedMs", "9000")
      .attach("photo", Buffer.from("%PDF-1.4"), { filename: "x.pdf", contentType: "application/pdf" });
    assert.equal(res.status, 400);
  });
});

describe("spam prevention", () => {
  test("honeypot and too-fast submissions are rejected", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);
    assert.equal((await submitReport(tag.code, { website: "http://spam" })).status, 400);
    assert.equal((await submitReport(tag.code, { elapsedMs: 500 })).status, 400);
    assert.equal((await submitReport(tag.code, { elapsedMs: undefined })).status, 400);
  });

  test("per-tag hourly limit", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);
    for (let i = 0; i < 5; i++) assert.equal((await submitReport(tag.code)).status, 201);
    const sixth = await submitReport(tag.code);
    assert.equal(sixth.status, 429);
  });

  test("marking spam blocks the sender and reverts the tag", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);
    const spammerIp = nextIp();
    const { reportId } = (await submitReport(tag.code, { message: "Buy cheap watches now!!" }, spammerIp)).body;

    const res = await api().patch(`/api/reports/${reportId}`).set(owner.auth).send({ action: "spam" });
    assert.equal(res.body.report.status, "spam");
    assert.equal(res.body.tag.status, "active", "the spam report shouldn't leave the tag marked found");

    // Blocked from every tag of this owner, but not from other owners' tags
    const secondTag = await createTag(owner);
    assert.equal((await submitReport(secondTag.code, {}, spammerIp)).status, 403);
    const otherOwnerTag = await createTag(await registerUser("Other"));
    assert.equal((await submitReport(otherOwnerTag.code, {}, spammerIp)).status, 201);

    const stats = await api().get("/api/stats/me").set(owner.auth);
    assert.equal(stats.body.incidents.cancelled, 1);

    // Reopening lifts the block
    await api().patch(`/api/reports/${reportId}`).set(owner.auth).send({ action: "reopen" });
    assert.equal((await submitReport(secondTag.code, {}, spammerIp)).status, 201);
  });

  test("spam on a tag the owner marked lost keeps it lost", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);
    await api().post(`/api/tags/${tag.id}/status`).set(owner.auth).send({ status: "lost" });
    const { reportId } = (await submitReport(tag.code)).body;
    const res = await api().patch(`/api/reports/${reportId}`).set(owner.auth).send({ action: "spam" });
    assert.equal(res.body.tag.status, "lost");
  });
});
