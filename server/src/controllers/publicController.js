import sharp from "sharp";
import Tag from "../models/Tag.js";
import Report from "../models/Report.js";
import Message from "../models/Message.js";
import Photo from "../models/Photo.js";
import Block from "../models/Block.js";
import { httpError } from "../middleware/errorHandler.js";
import { email, oneOf, str } from "../utils/validate.js";
import { TAG_CODE_LENGTH, normalizeCode, publicAppUrl } from "../utils/codes.js";
import { encrypt, hashToken, hmac, randomToken, safeEqual } from "../utils/crypto.js";
import { cleanMessage, excerpt } from "../utils/text.js";
import { serializeMessage } from "../utils/serialize.js";
import { verifyCaptcha } from "../services/captcha.js";
import { notifyOwner, notifyFinder } from "../services/notify.js";
import { markFoundByFinder } from "../services/tagLifecycle.js";

// Everything here is reachable without an account, so nothing about the owner is ever returned

const ACCEPTING = ["active", "lost", "found", "returned"];
const MIN_FORM_MS = 3000; // humans take longer than this to describe where they found something
const PER_TAG_PER_HOUR = 5;
const PER_SENDER_PER_DAY = 20;
const HOUR = 60 * 60 * 1000;

function publicState(status) {
  if (status === "unclaimed") return "unclaimed";
  if (status === "disabled") return "inactive";
  if (status === "lost" || status === "found") return status;
  return "ok";
}

async function findTagByCode(rawCode) {
  const code = normalizeCode(rawCode);
  const tag = code.length === TAG_CODE_LENGTH ? await Tag.findOne({ code }) : null;
  if (!tag) throw httpError(404, "No tag with this code");
  return tag;
}

export async function getPublicTag(req, res) {
  const tag = await findTagByCode(req.params.code);

  if (tag.owner) {
    // timestamps: false so a scan doesn't reorder the owner's dashboard
    await Tag.updateOne(
      { _id: tag._id },
      { $inc: { scanCount: 1 }, $set: { lastScannedAt: new Date() } },
      { timestamps: false }
    );
  }

  res.json({
    tag: {
      code: tag.code,
      publicLabel: tag.publicLabel || "An item",
      category: tag.item.category,
      publicMessage: tag.publicMessage,
      rewardOffered: tag.rewardOffered,
      state: publicState(tag.status),
      acceptingReports: ACCEPTING.includes(tag.status),
    },
  });
}

function readLocation(body) {
  const text = str(body.locationText, "locationText", { max: 140 }) ?? "";
  const hasCoords = body.lat !== undefined && body.lat !== "" && body.lng !== undefined && body.lng !== "";
  if (!text && !hasCoords) return null;

  const location = { text, lat: null, lng: null, precision: "approx" };
  if (hasCoords) {
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw httpError(400, "Location coordinates are invalid");
    }
    location.precision = body.precision === undefined ? "approx" : oneOf(body.precision, "precision", ["approx", "exact"]);
    // 3 decimals ≈ 110 m: enough to know which building, not which desk
    const decimals = location.precision === "exact" ? 5 : 3;
    location.lat = Number(lat.toFixed(decimals));
    location.lng = Number(lng.toFixed(decimals));
  }
  return location;
}

// Re-encoding drops all metadata (EXIF, GPS, camera serial) because sharp only keeps it when asked
async function processPhoto(file) {
  if (!file) return null;
  try {
    return await sharp(file.buffer)
      .rotate() // apply the EXIF orientation before it's stripped
      .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
  } catch {
    throw httpError(400, "That photo couldn't be read. Try a JPEG or PNG.");
  }
}

export async function createReport(req, res) {
  const body = req.body ?? {};

  // Bot checks first, with a deliberately vague message
  const elapsed = Number(body.elapsedMs);
  if (body.website || !Number.isFinite(elapsed) || elapsed < MIN_FORM_MS) {
    throw httpError(400, "We couldn't send your report. Please wait a moment and try again.");
  }
  if (!(await verifyCaptcha(body.captchaToken, req.ip))) {
    throw httpError(400, "Please complete the CAPTCHA check");
  }

  const tag = await findTagByCode(req.params.code);
  if (!ACCEPTING.includes(tag.status)) throw httpError(409, "This tag isn't accepting reports right now");

  // Validate everything before changing any state
  const message = cleanMessage(str(body.message, "message", { required: true, max: 1000 }));
  if (message.length < 5) throw httpError(400, "Please write a little more about where the item is");
  const alias = str(body.alias, "nickname", { max: 40 }) || "Finder";
  const finderEmail = email(body.email);
  const location = readLocation(body);
  const photo = await processPhoto(req.file);

  const ipHash = hmac(req.ip);
  const now = Date.now();
  const [blocked, recentForTag, recentFromSender] = await Promise.all([
    Block.exists({ owner: tag.owner, ipHash }),
    Report.countDocuments({ tag: tag._id, createdAt: { $gte: new Date(now - HOUR) } }),
    Report.countDocuments({ ipHash, createdAt: { $gte: new Date(now - 24 * HOUR) } }),
  ]);
  if (blocked) throw httpError(403, "This tag isn't accepting reports from you");
  if (recentForTag >= PER_TAG_PER_HOUR) {
    throw httpError(429, "This tag has received several reports recently. Please try again in an hour.");
  }
  if (recentFromSender >= PER_SENDER_PER_DAY) throw httpError(429, "Too many reports today. Please try again tomorrow.");

  const incident = await markFoundByFinder(tag);
  const token = randomToken();
  const report = await Report.create({
    tag: tag._id,
    owner: tag.owner,
    incident: incident._id,
    tagSnapshot: { code: tag.code, publicLabel: tag.publicLabel, category: tag.item.category },
    alias,
    location,
    hasPhoto: Boolean(photo),
    finderTokenHash: hashToken(token),
    finderEmailEnc: finderEmail ? encrypt(finderEmail) : null,
    finderTokenEnc: finderEmail ? encrypt(token) : null,
    ipHash,
    summary: excerpt(message),
    lastExcerpt: excerpt(message),
  });
  await Message.create({ report: report._id, sender: "finder", body: message });
  if (photo) await Photo.create({ report: report._id, data: photo });

  const finderUrl = `${publicAppUrl()}/r/${report._id}#${token}`;
  const label = tag.publicLabel || tag.item.name || "item";
  notifyOwner(tag.owner, {
    subject: `Someone found your ${label}`,
    text: `A finder scanned your ReturnTag and sent a message${location ? " with a location" : ""}. Reply in the app. Your contact details stay private.`,
    path: `/inbox/${report._id}`,
  });
  if (finderEmail) {
    notifyFinder(report, {
      subject: "Thanks for reporting a found item",
      text: `Thank you for reporting the ${label} you found. We've let the owner know, and we'll email you when they reply.`,
    });
  }

  res.status(201).json({ reportId: report._id, token, finderUrl });
}

async function loadFinderReport(req) {
  const token = req.get("x-finder-token");
  const report = await Report.findById(req.params.id).select("+finderTokenHash");
  if (!report || typeof token !== "string" || !safeEqual(hashToken(token), report.finderTokenHash)) {
    // Same answer for "no such report" and "wrong token", so ids can't be probed
    throw httpError(404, "Conversation not found. Make sure you opened your full private link.");
  }
  return report;
}

export async function getFinderReport(req, res) {
  const report = await loadFinderReport(req);
  const messages = await Message.find({ report: report._id }).sort({ createdAt: 1 });
  if (report.finderUnread) await Report.updateOne({ _id: report._id }, { finderUnread: 0 }, { timestamps: false });

  const snapshot = report.tagSnapshot || {};
  res.json({
    report: {
      id: report._id,
      status: report.status,
      alias: report.alias,
      createdAt: report.createdAt,
      tag: { code: snapshot.code, publicLabel: snapshot.publicLabel || "An item", category: snapshot.category || "other" },
    },
    messages: messages.map(serializeMessage),
  });
}

export async function postFinderMessage(req, res) {
  const report = await loadFinderReport(req);
  if (report.status !== "open") throw httpError(409, "This conversation is closed");

  const body = cleanMessage(str(req.body?.body, "message", { required: true, max: 1000 }));
  if (!body) throw httpError(400, "Message is required");

  const message = await Message.create({ report: report._id, sender: "finder", body });
  await Report.updateOne(
    { _id: report._id },
    { $inc: { ownerUnread: 1 }, $set: { lastMessageAt: message.createdAt, lastExcerpt: excerpt(body) } }
  );

  // Email only for the first unread message so a chatty thread doesn't flood the inbox; push every time
  const label = report.tagSnapshot?.publicLabel || "item";
  notifyOwner(report.owner, {
    subject: `New message about your ${label}`,
    text: excerpt(body, 120),
    path: `/inbox/${report._id}`,
    email: report.ownerUnread === 0,
  });

  res.status(201).json({ message: serializeMessage(message) });
}
