import Tag, { CATEGORIES } from "../models/Tag.js";
import Report from "../models/Report.js";
import Incident from "../models/Incident.js";
import { httpError } from "../middleware/errorHandler.js";
import { bool, email, oneOf, str } from "../utils/validate.js";
import { newTagCode, normalizeCode, publicAppUrl } from "../utils/codes.js";
import { hashToken, hmac, randomToken, safeEqual } from "../utils/crypto.js";
import { serializeIncident, serializeReportSummary, serializeTag } from "../utils/serialize.js";
import { sendEmail } from "../services/notify.js";
import {
  OWNER_TRANSITIONS,
  REASSIGNED_MESSAGE,
  cancelIncident,
  closeOpenReports,
  markLost,
  markReturned,
} from "../services/tagLifecycle.js";

const TRANSFER_DAYS = 7;
const NO_TRANSFER = { toEmail: null, expiresAt: null, tokenHash: null };

// Reads the owner-editable fields as Mongoose paths. With `partial` (PATCH) only the
// fields that were sent are returned, but any field that is sent must still be valid.
function readTagFields(body, { partial = false } = {}) {
  const fields = {};
  const { item } = body;

  if (item !== undefined || !partial) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw httpError(400, "Item details are required");
    }
    const name = str(item.name, "itemName", { required: !partial || item.name !== undefined, max: 80 });
    if (name !== undefined) fields["item.name"] = name;
    if (item.category !== undefined) fields["item.category"] = oneOf(item.category, "category", CATEGORIES);
    else if (!partial) fields["item.category"] = "other";
    if (item.description !== undefined || !partial) {
      fields["item.description"] = str(item.description, "description", { max: 500 }) ?? "";
    }
  }

  const label = str(body.publicLabel, "publicLabel", { required: !partial || body.publicLabel !== undefined, max: 60 });
  if (label !== undefined) fields.publicLabel = label;
  if (body.publicMessage !== undefined || !partial) {
    fields.publicMessage = str(body.publicMessage, "publicMessage", { max: 280 }) ?? "";
  }
  if (body.rewardOffered !== undefined || !partial) fields.rewardOffered = Boolean(bool(body.rewardOffered));

  return fields;
}

const applyFields = (tag, fields) => {
  for (const [path, value] of Object.entries(fields)) tag.set(path, value);
};

// history is select:false, so append with $push instead of loading and re-saving the array
const addHistory = (tagId, owner, reason) =>
  Tag.updateOne({ _id: tagId }, { $push: { history: { owner, reason, at: new Date() } } }, { timestamps: false });

async function assertUnderLimit(user) {
  const limit = user.tagLimit();
  if (limit === null) return;
  if ((await Tag.countDocuments({ owner: user._id })) >= limit) {
    throw httpError(403, `The free plan includes ${limit} tags. Upgrade to premium for unlimited tags.`);
  }
}

async function loadOwnedTag(req) {
  const tag = await Tag.findOne({ _id: req.params.id, owner: req.user._id });
  if (!tag) throw httpError(404, "Tag not found");
  return tag;
}

// Open-report and unread counts per tag, for badges
async function reportCounts(owner, tagIds) {
  const rows = await Report.aggregate([
    { $match: { owner, tag: { $in: tagIds }, status: "open" } },
    { $group: { _id: "$tag", openReports: { $sum: 1 }, unread: { $sum: "$ownerUnread" } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
}

async function tagResponse(tag) {
  const counts = await reportCounts(tag.owner, [tag._id]);
  return serializeTag(tag, counts.get(String(tag._id)));
}

export async function listTags(req, res) {
  const tags = await Tag.find({ owner: req.user._id }).sort({ updatedAt: -1 });
  const counts = await reportCounts(req.user._id, tags.map((tag) => tag._id));
  // Tags that need attention first; sort is stable so the rest keep most-recent-first
  const urgency = { found: 0, lost: 1 };
  tags.sort((a, b) => (urgency[a.status] ?? 2) - (urgency[b.status] ?? 2));
  res.json({ tags: tags.map((tag) => serializeTag(tag, counts.get(String(tag._id)))) });
}

export async function createTag(req, res) {
  const fields = readTagFields(req.body ?? {});
  await assertUnderLimit(req.user);

  const tag = new Tag({ owner: req.user._id, status: "active", history: [{ owner: req.user._id, reason: "created" }] });
  applyFields(tag, fields);

  // A collision in 5.9e14 codes is practically impossible, but retry rather than fail
  for (let attempt = 1; ; attempt++) {
    tag.code = newTagCode();
    try {
      await tag.save();
      break;
    } catch (err) {
      if (err.code !== 11000 || attempt >= 5) throw err;
    }
  }

  res.status(201).json({ tag: serializeTag(tag) });
}

export async function claimTag(req, res) {
  const body = req.body ?? {};
  const code = normalizeCode(body.code);
  const claimCode = normalizeCode(body.claimCode);
  if (!code || !claimCode) throw httpError(400, "Enter the tag code and the claim code");

  const tag = await Tag.findOne({ code, status: "unclaimed" }).select("+claimCodeHash");
  if (!tag || !safeEqual(hmac(claimCode), tag.claimCodeHash)) {
    throw httpError(400, "That tag code and claim code don't match an unclaimed tag");
  }
  await assertUnderLimit(req.user);

  // Conditional update so two people can't claim the same tag at once
  const result = await Tag.updateOne(
    { _id: tag._id, status: "unclaimed" },
    {
      $set: { owner: req.user._id, status: "active" },
      $unset: { claimCodeHash: 1 },
      $push: { history: { owner: req.user._id, reason: "claimed", at: new Date() } },
    }
  );
  if (!result.modifiedCount) throw httpError(409, "This tag was just claimed by someone else");

  res.json({ tag: serializeTag(await Tag.findById(tag._id)) });
}

export async function getTag(req, res) {
  const tag = await loadOwnedTag(req);
  const [reports, incidents] = await Promise.all([
    Report.find({ tag: tag._id, owner: req.user._id }).sort({ lastMessageAt: -1 }),
    Incident.find({ tag: tag._id, owner: req.user._id }).sort({ createdAt: -1 }).limit(20),
  ]);

  res.json({
    tag: await tagResponse(tag),
    reports: reports.map((report) => serializeReportSummary(report, tag)),
    incidents: incidents.map(serializeIncident),
  });
}

export async function updateTag(req, res) {
  const fields = readTagFields(req.body ?? {}, { partial: true });
  const tag = await loadOwnedTag(req);
  applyFields(tag, fields);
  await tag.save();
  res.json({ tag: await tagResponse(tag) });
}

export async function changeStatus(req, res) {
  const next = oneOf(req.body?.status, "status", Object.keys(OWNER_TRANSITIONS));
  const tag = await loadOwnedTag(req);
  const from = tag.status;

  if (!OWNER_TRANSITIONS[next].includes(from)) {
    throw httpError(409, `A ${from} tag can't be changed to ${next}`);
  }

  if (next === "lost") await markLost(tag);
  else if (next === "returned") await markReturned(tag);
  else if (next === "disabled") await cancelIncident(tag, "disabled");
  else if (from === "lost") await cancelIncident(tag, "active"); // false alarm
  else {
    tag.status = "active";
    await tag.save();
  }

  res.json({ tag: await tagResponse(tag) });
}

// Reuse a physical sticker on a different item. Old conversations are closed and the
// new item starts with a clean slate (same code, so the printed QR keeps working).
export async function relinkTag(req, res) {
  const fields = readTagFields(req.body ?? {});
  const tag = await loadOwnedTag(req);

  await closeOpenReports(tag, REASSIGNED_MESSAGE);
  await cancelIncident(tag, "active");
  tag.returnedAt = null;
  applyFields(tag, fields);
  await tag.save();
  await addHistory(tag._id, req.user._id, "relinked");

  res.json({ tag: await tagResponse(tag) });
}

export async function startTransfer(req, res) {
  const toEmail = email(req.body?.email, "email", { required: true });
  if (toEmail === req.user.email) throw httpError(400, "You already own this tag");
  const tag = await loadOwnedTag(req);

  const token = randomToken();
  tag.transfer = {
    toEmail,
    expiresAt: new Date(Date.now() + TRANSFER_DAYS * 24 * 60 * 60 * 1000),
    tokenHash: hashToken(token),
  };
  await tag.save();

  // Token in the fragment, like finder links, so it stays out of server logs
  const transferUrl = `${publicAppUrl()}/transfer#${token}`;
  const label = tag.publicLabel || tag.item.name || "an item";
  sendEmail({
    to: toEmail,
    subject: `${req.user.name} wants to give you a ReturnTag`,
    text: `${req.user.name} is transferring the ReturnTag on "${label}" to you.\n\nAccept it here (log in or sign up with ${toEmail}): ${transferUrl}\n\nThis link expires in ${TRANSFER_DAYS} days.`,
  });

  res.json({ tag: await tagResponse(tag), transferUrl });
}

export async function cancelTransfer(req, res) {
  const tag = await loadOwnedTag(req);
  tag.transfer = NO_TRANSFER;
  await tag.save();
  res.json({ tag: await tagResponse(tag) });
}

async function findTransfer(token) {
  const tag =
    typeof token === "string" && token.length >= 20
      ? await Tag.findOne({ "transfer.tokenHash": hashToken(token), "transfer.expiresAt": { $gt: new Date() } })
      : null;
  if (!tag) throw httpError(404, "This transfer link is invalid or has expired");
  return tag;
}

export async function previewTransfer(req, res) {
  const tag = await findTransfer(req.body?.token);
  res.json({
    transfer: {
      publicLabel: tag.publicLabel || "An item",
      category: tag.item.category,
      code: tag.code,
      toEmail: tag.transfer.toEmail,
      expiresAt: tag.transfer.expiresAt,
    },
  });
}

export async function acceptTransfer(req, res) {
  const tag = await findTransfer(req.body?.token);
  if (tag.transfer.toEmail !== req.user.email) {
    throw httpError(403, `This transfer was sent to ${tag.transfer.toEmail}. Log in with that account to accept it.`);
  }
  await assertUnderLimit(req.user);

  // Close the previous owner's conversations and incident before ownership changes.
  // Their reports keep `owner` = previous owner, so the new owner never sees them.
  await closeOpenReports(tag, REASSIGNED_MESSAGE);
  await cancelIncident(tag, "active");

  tag.owner = req.user._id;
  // Clear anything personal to the previous owner
  applyFields(tag, { "item.description": "", publicMessage: "", rewardOffered: false, returnedAt: null, transfer: NO_TRANSFER });
  await tag.save();
  await addHistory(tag._id, req.user._id, "transferred");

  res.json({ tag: await tagResponse(tag) });
}
