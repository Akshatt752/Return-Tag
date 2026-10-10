import Report from "../models/Report.js";
import Message from "../models/Message.js";
import Photo from "../models/Photo.js";
import Tag from "../models/Tag.js";
import Block from "../models/Block.js";
import { httpError } from "../middleware/errorHandler.js";
import { oneOf, str } from "../utils/validate.js";
import { cleanMessage, excerpt } from "../utils/text.js";
import { serializeMessage, serializeReportDetail, serializeReportSummary, serializeTag } from "../utils/serialize.js";
import { notifyFinder } from "../services/notify.js";
import {
  CLOSED_MESSAGE,
  RETURNED_MESSAGE,
  closeReports,
  markReturned,
  revertFoundIfUnsupported,
} from "../services/tagLifecycle.js";

const STATUS_FILTERS = ["open", "resolved", "spam", "all"];

async function loadOwnedReport(req, select = "") {
  const report = await Report.findOne({ _id: req.params.id, owner: req.user._id }).select(select);
  if (!report) throw httpError(404, "Report not found");
  return report;
}

const ownsTag = (tag, userId) => Boolean(tag && String(tag.owner) === String(userId));

export async function listReports(req, res) {
  const status = req.query.status === undefined ? "open" : oneOf(req.query.status, "status", STATUS_FILTERS);
  const filter = { owner: req.user._id };
  if (status !== "all") filter.status = status;

  const reports = await Report.find(filter).sort({ lastMessageAt: -1 }).limit(200);
  const tags = await Tag.find({ _id: { $in: [...new Set(reports.map((r) => String(r.tag)))] } });
  const tagsById = new Map(tags.map((tag) => [String(tag._id), tag]));

  res.json({ reports: reports.map((report) => serializeReportSummary(report, tagsById.get(String(report.tag)))) });
}

export async function getReport(req, res) {
  const report = await loadOwnedReport(req);
  const [tag, messages] = await Promise.all([
    Tag.findById(report.tag),
    Message.find({ report: report._id }).sort({ createdAt: 1 }),
  ]);

  if (report.ownerUnread) {
    await Report.updateOne({ _id: report._id }, { ownerUnread: 0 }, { timestamps: false });
    report.ownerUnread = 0;
  }

  res.json({ report: serializeReportDetail(report, tag), messages: messages.map(serializeMessage) });
}

export async function postOwnerMessage(req, res) {
  const body = cleanMessage(str(req.body?.body, "message", { required: true, max: 1000 }));
  if (!body) throw httpError(400, "Message is required");
  const report = await loadOwnedReport(req, "+finderEmailEnc +finderTokenEnc");
  if (report.status !== "open") throw httpError(409, "This conversation is closed. Reopen it to reply.");

  const message = await Message.create({ report: report._id, sender: "owner", body });
  await Report.updateOne(
    { _id: report._id },
    { $inc: { finderUnread: 1 }, $set: { lastMessageAt: message.createdAt, lastExcerpt: excerpt(body) } }
  );

  // Only email the finder for the first unread reply so a conversation doesn't flood them
  if (report.finderUnread === 0) {
    notifyFinder(report, {
      subject: "The owner replied about the item you found",
      text: `The owner of the ${report.tagSnapshot?.publicLabel || "item"} you found sent you a message.`,
    });
  }

  res.status(201).json({ message: serializeMessage(message) });
}

export async function updateReport(req, res) {
  const action = oneOf(req.body?.action, "action", ["returned", "close", "spam", "reopen"]);
  const report = await loadOwnedReport(req, "+ipHash");
  let tag = await Tag.findById(report.tag);
  const owned = ownsTag(tag, req.user._id);

  if (action === "reopen") {
    if (report.status === "open") throw httpError(409, "This conversation is already open");
    if (!owned) throw httpError(409, "This tag now belongs to someone else");
    if (report.status === "spam" && report.ipHash) await Block.deleteOne({ owner: req.user._id, ipHash: report.ipHash });
    await Report.updateOne({ _id: report._id }, { status: "open", resolvedAt: null });
  } else {
    if (report.status !== "open") throw httpError(409, "Only open conversations can be changed");

    if (action === "returned" && owned && ["lost", "found"].includes(tag.status)) {
      // Closes this and every other open report on the tag, and records the recovery
      await markReturned(tag);
    } else if (action === "returned") {
      await closeReports({ _id: report._id }, RETURNED_MESSAGE);
    } else if (action === "close") {
      await closeReports({ _id: report._id }, CLOSED_MESSAGE);
    } else {
      // spam: close quietly and block the sender from all of this owner's tags
      await closeReports({ _id: report._id }, CLOSED_MESSAGE);
      await Report.updateOne({ _id: report._id }, { status: "spam" });
      if (report.ipHash) {
        await Block.updateOne(
          { owner: req.user._id, ipHash: report.ipHash },
          { $setOnInsert: { report: report._id } },
          { upsert: true }
        );
      }
    }

    // A closed or spam report shouldn't leave the tag showing "found"
    if (owned && action !== "returned") await revertFoundIfUnsupported(tag);
  }

  const updated = await Report.findById(report._id);
  if (owned) tag = await Tag.findById(tag._id);
  res.json({ report: serializeReportDetail(updated, tag), tag: owned ? serializeTag(tag) : null });
}

export async function getPhoto(req, res) {
  const report = await loadOwnedReport(req);
  const photo = report.hasPhoto ? await Photo.findOne({ report: report._id }) : null;
  if (!photo) throw httpError(404, "No photo for this report");

  res.set("Cache-Control", "private, max-age=3600");
  res.type(photo.contentType).send(photo.data);
}
