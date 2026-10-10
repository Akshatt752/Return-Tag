import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { TAG_BODY, api, createTag, registerUser, startDb, stopDb, submitReport } from "./setup.js";

before(startDb);
after(stopDb);

describe("auth", () => {
  test("register, login and me", async () => {
    const owner = await registerUser("Asha");
    assert.equal(owner.user.plan, "free");
    assert.equal(owner.user.tagLimit, 3);
    assert.equal(owner.user.role, "user");

    const login = await api().post("/api/auth/login").send({ email: owner.email, password: "password123" });
    assert.equal(login.status, 200);
    const me = await api().get("/api/auth/me").set("Authorization", `Bearer ${login.body.token}`);
    assert.equal(me.body.user.email, owner.email);
  });

  test("rejects operator injection and wrong passwords", async () => {
    const owner = await registerUser("Ravi");
    const injected = await api().post("/api/auth/login").send({ email: { $gt: "" }, password: "x" });
    assert.equal(injected.status, 400);
    const wrong = await api().post("/api/auth/login").send({ email: owner.email, password: "nope-nope" });
    assert.equal(wrong.status, 401);
  });

  test("ADMIN_EMAILS promotes listed accounts on register and login", async () => {
    const existing = await registerUser("Later Admin");
    assert.equal(existing.user.role, "user");

    process.env.ADMIN_EMAILS = ` someone@else.com, ${existing.email.toUpperCase()} `;
    try {
      const login = await api().post("/api/auth/login").send({ email: existing.email, password: "password123" });
      assert.equal(login.body.user.role, "admin");

      const fresh = await api()
        .post("/api/auth/register")
        .send({ name: "New", email: "someone@else.com", password: "password123" });
      assert.equal(fresh.body.user.role, "admin");
      assert.equal((await registerUser("Regular")).user.role, "user");
    } finally {
      delete process.env.ADMIN_EMAILS;
    }
  });

  test("updates notification preferences", async () => {
    const owner = await registerUser("Meera");
    const res = await api().patch("/api/auth/me").set(owner.auth).send({ notify: { email: false } });
    assert.deepEqual(res.body.user.notify, { email: false, push: true });
  });
});

describe("tags", () => {
  test("create, list, get and edit", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);
    assert.match(tag.code, /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{10}$/);
    assert.equal(tag.url, `https://returntag.test/t/${tag.code}`);
    assert.equal(tag.status, "active");

    const list = await api().get("/api/tags").set(owner.auth);
    assert.equal(list.body.tags.length, 1);

    const edit = await api().patch(`/api/tags/${tag.id}`).set(owner.auth).send({ publicLabel: "Grey laptop" });
    assert.equal(edit.body.tag.publicLabel, "Grey laptop");
    assert.equal(edit.body.tag.item.name, "MacBook Pro 14", "partial update keeps other fields");

    const blank = await api().patch(`/api/tags/${tag.id}`).set(owner.auth).send({ publicLabel: "" });
    assert.equal(blank.status, 400);
  });

  test("other users can't see or edit a tag", async () => {
    const owner = await registerUser();
    const stranger = await registerUser("Stranger");
    const tag = await createTag(owner);
    assert.equal((await api().get(`/api/tags/${tag.id}`).set(stranger.auth)).status, 404);
    assert.equal((await api().patch(`/api/tags/${tag.id}`).set(stranger.auth).send({ publicLabel: "x" })).status, 404);
  });

  test("free plan limit", async () => {
    const owner = await registerUser();
    for (let i = 0; i < 3; i++) await createTag(owner);
    const res = await api().post("/api/tags").set(owner.auth).send(TAG_BODY);
    assert.equal(res.status, 403);
    assert.match(res.body.message, /free plan includes 3 tags/);
  });

  test("validates categories", async () => {
    const owner = await registerUser();
    const res = await api()
      .post("/api/tags")
      .set(owner.auth)
      .send({ ...TAG_BODY, item: { ...TAG_BODY.item, category: "spaceship" } });
    assert.equal(res.status, 400);
  });
});

describe("status lifecycle and stats", () => {
  test("lost → returned is a recovery", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);

    const lost = await api().post(`/api/tags/${tag.id}/status`).set(owner.auth).send({ status: "lost" });
    assert.equal(lost.body.tag.status, "lost");
    assert.ok(lost.body.tag.lostAt);

    const returned = await api().post(`/api/tags/${tag.id}/status`).set(owner.auth).send({ status: "returned" });
    assert.equal(returned.body.tag.status, "returned");

    const stats = await api().get("/api/stats/me").set(owner.auth);
    assert.equal(stats.body.incidents.recovered, 1);
    assert.equal(stats.body.recoveryRate, 1);
    assert.equal(stats.body.tags.returned, 1);
    assert.equal(stats.body.monthly.length, 6);
    assert.equal(stats.body.monthly.at(-1).recovered, 1);
    assert.equal(stats.body.recent[0].publicLabel, "Silver laptop");
  });

  test("false alarm cancels the incident and doesn't count against recovery", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);
    await api().post(`/api/tags/${tag.id}/status`).set(owner.auth).send({ status: "lost" });
    const back = await api().post(`/api/tags/${tag.id}/status`).set(owner.auth).send({ status: "active" });
    assert.equal(back.body.tag.status, "active");
    assert.equal(back.body.tag.lostAt, null);

    const stats = await api().get("/api/stats/me").set(owner.auth);
    assert.equal(stats.body.incidents.cancelled, 1);
    assert.equal(stats.body.recoveryRate, null);
  });

  test("rejects invalid transitions", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);
    const res = await api().post(`/api/tags/${tag.id}/status`).set(owner.auth).send({ status: "returned" });
    assert.equal(res.status, 409);
    const bogus = await api().post(`/api/tags/${tag.id}/status`).set(owner.auth).send({ status: "found" });
    assert.equal(bogus.status, 400, "owners can't set found; only a finder report does");
  });

  test("disabled tags stop accepting reports", async () => {
    const owner = await registerUser();
    const tag = await createTag(owner);
    await api().post(`/api/tags/${tag.id}/status`).set(owner.auth).send({ status: "disabled" });

    const view = await api().get(`/api/public/tags/${tag.code}`);
    assert.equal(view.body.tag.state, "inactive");
    assert.equal(view.body.tag.acceptingReports, false);
    assert.equal((await submitReport(tag.code)).status, 409);
  });

  test("public stats", async () => {
    const res = await api().get("/api/stats/public");
    assert.equal(res.status, 200);
    assert.ok("itemsReturned" in res.body && "tagsProtected" in res.body);
  });
});
