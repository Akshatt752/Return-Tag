import Tag from "../models/Tag.js";
import TagBatch from "../models/TagBatch.js";
import Report from "../models/Report.js";
import User from "../models/User.js";
import { httpError } from "../middleware/errorHandler.js";
import { email, oneOf, str } from "../utils/validate.js";
import { newClaimCode, newTagCode, tagUrl } from "../utils/codes.js";
import { hmac } from "../utils/crypto.js";
import { serializeUser } from "../utils/serialize.js";
import { incidentSummary, tagStatusCounts } from "./statsController.js";

export async function adminStats(req, res) {
  const [users, premiumUsers, tagStats, reportRows, incidents] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ plan: "premium" }),
    tagStatusCounts(),
    Report.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    incidentSummary(),
  ]);
  const reportsBy = Object.fromEntries(reportRows.map((row) => [row._id, row.count]));

  res.json({
    users,
    premiumUsers,
    tags: tagStats.counts,
    reports: {
      total: reportRows.reduce((sum, row) => sum + row.count, 0),
      open: reportsBy.open ?? 0,
      spam: reportsBy.spam ?? 0,
    },
    incidents: { total: incidents.total, recovered: incidents.recovered },
    recoveryRate: incidents.recoveryRate,
    avgRecoveryHours: incidents.avgRecoveryHours,
  });
}

const serializeBatch = (batch, claimed) => ({
  id: batch._id,
  name: batch.name,
  organization: batch.organization,
  count: batch.count,
  claimed,
  createdAt: batch.createdAt,
});

export async function listBatches(req, res) {
  const batches = await TagBatch.find().sort({ createdAt: -1 }).limit(200);
  const claimedRows = await Tag.aggregate([
    { $match: { batch: { $in: batches.map((b) => b._id) }, owner: { $ne: null } } },
    { $group: { _id: "$batch", count: { $sum: 1 } } },
  ]);
  const claimed = new Map(claimedRows.map((row) => [String(row._id), row.count]));
  res.json({ batches: batches.map((batch) => serializeBatch(batch, claimed.get(String(batch._id)) ?? 0)) });
}

// Pre-printed tags for schools, businesses and partner brands. Each sticker gets a public
// code (the QR) and a secret claim code (printed inside the packaging). Only the claim
// code's HMAC is stored, so this response is the only time the claim codes exist in plain text.
export async function createBatch(req, res) {
  const body = req.body ?? {};
  const name = str(body.name, "name", { required: true, max: 80 });
  const organization = str(body.organization, "organization", { max: 80 }) ?? "";
  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    throw httpError(400, "Count must be a whole number from 1 to 500");
  }

  const batch = await TagBatch.create({ name, organization, count, createdBy: req.user._id });

  const codes = new Set();
  while (codes.size < count) codes.add(newTagCode());
  const rows = [...codes].map((code) => ({ code, claimCode: newClaimCode() }));

  try {
    await Tag.insertMany(
      rows.map(({ code, claimCode }) => ({ code, claimCodeHash: hmac(claimCode), batch: batch._id, status: "unclaimed" }))
    );
  } catch (err) {
    // Roll back so a half-created batch never ships
    await Promise.all([Tag.deleteMany({ batch: batch._id }), TagBatch.deleteOne({ _id: batch._id })]);
    throw err;
  }

  res.status(201).json({
    batch: serializeBatch(batch, 0),
    tags: rows.map(({ code, claimCode }) => ({ code, url: tagUrl(code), claimCode })),
  });
}

export async function batchTags(req, res) {
  const batch = await TagBatch.findById(req.params.id);
  if (!batch) throw httpError(404, "Batch not found");
  const tags = await Tag.find({ batch: batch._id }).select("code owner").sort({ _id: 1 });
  const claimed = tags.filter((tag) => tag.owner).length;

  res.json({
    batch: serializeBatch(batch, claimed),
    tags: tags.map((tag) => ({ code: tag.code, url: tagUrl(tag.code), claimed: Boolean(tag.owner) })),
  });
}

// Reports that owners flagged as spam, for spotting abuse patterns
export async function flaggedReports(req, res) {
  const status = req.query.status === undefined ? "spam" : oneOf(req.query.status, "status", ["spam", "open", "resolved"]);
  const reports = await Report.find({ status }).sort({ updatedAt: -1 }).limit(100).populate("owner", "email");

  res.json({
    reports: reports.map((report) => ({
      id: report._id,
      status: report.status,
      excerpt: report.summary || report.lastExcerpt,
      tagCode: report.tagSnapshot?.code,
      ownerEmail: report.owner?.email ?? null,
      createdAt: report.createdAt,
    })),
  });
}

// Stand-in for payments: an admin upgrades accounts that bought premium
export async function setPlan(req, res) {
  const body = req.body ?? {};
  const address = email(body.email, "email", { required: true });
  const plan = oneOf(body.plan, "plan", ["free", "premium"]);

  const user = await User.findOne({ email: address });
  if (!user) throw httpError(404, "No account with that email");
  user.plan = plan;
  await user.save();
  res.json({ user: serializeUser(user) });
}
