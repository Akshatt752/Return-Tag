import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import User from "../src/models/User.js";
import Report from "../src/models/Report.js";
import Photo from "../src/models/Photo.js";
import { purgeStaleData } from "../src/jobs/purge.js";
import { TAG_BODY, api, createTag, finder, registerUser, startDb, stopDb, submitReport } from "./setup.js";

before(startDb);
after(stopDb);

const tokenFrom = (transferUrl) => transferUrl.split("#")[1];

describe("transfer", () => {
  test("moves the tag to the new owner and keeps old conversations private", async () => {
    const alice = await registerUser("Alice");
    const bob = await registerUser("Bob");
    const tag = await createTag(alice);
    const { reportId, token: finderToken } = (await submitReport(tag.code)).body;

    const started = await api().post(`/api/tags/${tag.id}/transfer`).set(alice.auth).send({ email: bob.email });
    assert.equal(started.status, 200);
    assert.equal(started.body.tag.pendingTransfer.toEmail, bob.email);
    const token = tokenFrom(started.body.transferUrl);

    const preview = await api().post("/api/tags/transfer/preview").set(bob.auth).send({ token });
    assert.equal(preview.body.transfer.code, tag.code);

    // Only the intended recipient can accept
    const carol = await registerUser("Carol");
    assert.equal((await api().post("/api/tags/transfer/accept").set(carol.auth).send({ token })).status, 403);

    const accepted = await api().post("/api/tags/transfer/accept").set(bob.auth).send({ token });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body.tag.status, "active");
    assert.equal(accepted.body.tag.item.description, "", "previous owner's private notes are cleared");
    assert.equal(accepted.body.tag.pendingTransfer, null);

    // Alice lost the tag but keeps her (now closed) conversation; Bob never sees it
    assert.equal((await api().get(`/api/tags/${tag.id}`).set(alice.auth)).status, 404);
    const aliceReport = await api().get(`/api/reports/${reportId}`).set(alice.auth);
    assert.equal(aliceReport.body.report.status, "resolved");
    assert.equal(aliceReport.body.report.tag.id, null, "no live link to a tag she no longer owns");
    assert.equal((await api().get(`/api/reports/${reportId}`).set(bob.auth)).status, 404);
    assert.equal((await api().get("/api/reports?status=all").set(bob.auth)).body.reports.length, 0);

    const finderView = await finder(reportId, finderToken).get();
    assert.match(finderView.body.messages.at(-1).body, /reassigned/);

    // Link is single-use
    assert.equal((await api().post("/api/tags/transfer/accept").set(bob.auth).send({ token })).status, 404);
  });

  test("can be cancelled", async () => {
    const alice = await registerUser("Alice");
    const bob = await registerUser("Bob");
    const tag = await createTag(alice);
    const started = await api().post(`/api/tags/${tag.id}/transfer`).set(alice.auth).send({ email: bob.email });
    await api().delete(`/api/tags/${tag.id}/transfer`).set(alice.auth);
    const res = await api().post("/api/tags/transfer/accept").set(bob.auth).send({ token: tokenFrom(started.body.transferUrl) });
    assert.equal(res.status, 404);
  });
});

describe("relink", () => {
  test("reuses the sticker for a new item and closes old reports", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);
    const { reportId } = (await submitReport(tag.code)).body;

    const res = await api()
      .post(`/api/tags/${tag.id}/relink`)
      .set(owner.auth)
      .send({ item: { name: "House keys", category: "keys" }, publicLabel: "Keys with a red fob" });
    assert.equal(res.status, 200);
    assert.equal(res.body.tag.code, tag.code, "same physical QR code");
    assert.equal(res.body.tag.status, "active");
    assert.equal(res.body.tag.publicMessage, "", "old public message doesn't carry over");
    assert.equal(res.body.tag.rewardOffered, false);

    const old = await api().get(`/api/reports/${reportId}`).set(owner.auth);
    assert.equal(old.body.report.status, "resolved");
    const view = await api().get(`/api/public/tags/${tag.code}`);
    assert.equal(view.body.tag.publicLabel, "Keys with a red fob");
  });
});

describe("admin batches and claiming", () => {
  test("non-admins are refused", async () => {
    const user = await registerUser();
    assert.equal((await api().get("/api/admin/stats").set(user.auth)).status, 403);
  });

  test("create a batch, claim a tag, track claimed count", async () => {
    const admin = await registerUser("Admin");
    await User.updateOne({ email: admin.email }, { role: "admin" });

    const created = await api()
      .post("/api/admin/batches")
      .set(admin.auth)
      .send({ name: "Fall orientation", organization: "Central School", count: 3 });
    assert.equal(created.status, 201);
    assert.equal(created.body.tags.length, 3);
    const [first] = created.body.tags;
    assert.match(first.claimCode, /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/);

    // An unclaimed tag can be scanned but not reported
    const view = await api().get(`/api/public/tags/${first.code}`);
    assert.equal(view.body.tag.state, "unclaimed");
    assert.equal((await submitReport(first.code)).status, 409);

    const student = await registerUser("Student");
    const wrong = await api().post("/api/tags/claim").set(student.auth).send({ code: first.code, claimCode: "AAAAAAAA" });
    assert.equal(wrong.status, 400);

    const claimed = await api()
      .post("/api/tags/claim")
      .set(student.auth)
      .send({ code: first.code.toLowerCase(), claimCode: first.claimCode });
    assert.equal(claimed.status, 200);
    assert.equal(claimed.body.tag.status, "active");

    // Claim codes are single use
    const again = await api().post("/api/tags/claim").set(admin.auth).send({ code: first.code, claimCode: first.claimCode });
    assert.equal(again.status, 400);

    const batches = await api().get("/api/admin/batches").set(admin.auth);
    assert.equal(batches.body.batches[0].claimed, 1);
    const listed = await api().get(`/api/admin/batches/${created.body.batch.id}/tags`).set(admin.auth);
    assert.ok(!JSON.stringify(listed.body).includes(first.claimCode), "claim codes are never shown again");

    const stats = await api().get("/api/admin/stats").set(admin.auth);
    assert.equal(stats.body.tags.unclaimed, 2);
  });

  test("set plan lifts the free tag limit", async () => {
    const admin = await registerUser("Admin");
    await User.updateOne({ email: admin.email }, { role: "admin" });
    const user = await registerUser();
    for (let i = 0; i < 3; i++) await createTag(user);

    const res = await api().patch("/api/admin/users/plan").set(admin.auth).send({ email: user.email, plan: "premium" });
    assert.equal(res.body.user.plan, "premium");
    assert.equal(res.body.user.tagLimit, null);
    assert.equal((await api().post("/api/tags").set(user.auth).send(TAG_BODY)).status, 201);
  });

  test("spam reports are listed for admins", async () => {
    const admin = await registerUser("Admin");
    await User.updateOne({ email: admin.email }, { role: "admin" });
    const owner = await registerUser();
    const tag = await createTag(owner);
    const { reportId } = (await submitReport(tag.code, { message: "Totally spam message" })).body;
    await api().patch(`/api/reports/${reportId}`).set(owner.auth).send({ action: "spam" });

    const res = await api().get("/api/admin/reports").set(admin.auth);
    const flagged = res.body.reports.find((r) => r.id === reportId);
    assert.equal(flagged.excerpt, "Totally spam message");
  });
});

describe("data retention", () => {
  test("purges finder location, photo and contact 30 days after closing", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);
    const { reportId } = (await submitReport(tag.code, { email: "f@example.com", lat: 10, lng: 20 })).body;
    await Photo.create({ report: reportId, data: Buffer.from("jpeg") });
    await Report.updateOne({ _id: reportId }, { hasPhoto: true });
    await api().patch(`/api/reports/${reportId}`).set(owner.auth).send({ action: "close" });

    // Not yet: closed less than 30 days ago
    assert.equal((await purgeStaleData()).purgedReports, 0);

    const later = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    // Other closed reports in this database qualify too, so check this one specifically below
    assert.ok((await purgeStaleData(later)).purgedReports >= 1);

    const report = await Report.findById(reportId).select("+finderEmailEnc +ipHash");
    assert.equal(report.location, null);
    assert.equal(report.finderEmailEnc, null);
    assert.equal(report.ipHash, null);
    assert.equal(report.hasPhoto, false);
    assert.equal(await Photo.countDocuments({ report: reportId }), 0);
    // The conversation itself remains readable by the owner
    assert.equal((await api().get(`/api/reports/${reportId}`).set(owner.auth)).body.messages.length, 2);
  });
});
