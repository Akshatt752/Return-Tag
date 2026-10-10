import Incident from "../models/Incident.js";
import Report from "../models/Report.js";
import Message from "../models/Message.js";
import { excerpt } from "../utils/text.js";

// Tag status rules. Every status change goes through here so tags, incidents (used for
// recovery stats) and finder conversations stay consistent.

export const RETURNED_MESSAGE = "The owner marked this item as returned. Thank you for helping!";
export const REASSIGNED_MESSAGE = "The owner has reassigned this tag, so this conversation is closed. Thank you!";
export const CLOSED_MESSAGE = "The owner closed this conversation.";

// Which statuses an owner may move a tag to, keyed by target status
export const OWNER_TRANSITIONS = {
  lost: ["active", "returned"],
  returned: ["lost", "found"],
  active: ["lost", "returned", "disabled"],
  disabled: ["active", "lost", "found", "returned"],
};

const findOpenIncident = (tag) => Incident.findOne({ tag: tag._id, owner: tag.owner, status: "open" });

async function closeIncident(tag, status, now = new Date()) {
  const incident = await findOpenIncident(tag);
  if (!incident) return null;
  incident.status = status;
  incident.closedAt = now;
  if (status === "recovered") {
    incident.durationMs = now - (incident.lostAt || incident.foundAt || incident.createdAt);
  }
  await incident.save();
  return incident;
}

// Adds a system message the finder will see and closes the conversation
export async function closeReports(filter, systemMessage, now = new Date()) {
  const reports = await Report.find({ ...filter, status: "open" }).select("_id");
  if (!reports.length) return;
  const ids = reports.map((report) => report._id);
  await Report.updateMany(
    { _id: { $in: ids } },
    {
      $set: { status: "resolved", resolvedAt: now, lastExcerpt: excerpt(systemMessage), lastMessageAt: now },
      $inc: { finderUnread: 1 },
    }
  );
  await Message.insertMany(ids.map((report) => ({ report, sender: "system", body: systemMessage })));
}

export const closeOpenReports = (tag, systemMessage, now) =>
  closeReports({ tag: tag._id, owner: tag.owner }, systemMessage, now);

export async function markLost(tag) {
  const now = new Date();
  if (!(await findOpenIncident(tag))) {
    await Incident.create({ tag: tag._id, owner: tag.owner, startedBy: "owner", lostAt: now });
  }
  Object.assign(tag, { status: "lost", lostAt: now, foundAt: null, returnedAt: null });
  await tag.save();
}

// A finder submitted a report. Works whether or not the owner already knew it was lost.
export async function markFoundByFinder(tag) {
  const now = new Date();
  let incident = await findOpenIncident(tag);
  if (!incident) {
    incident = await Incident.create({
      tag: tag._id,
      owner: tag.owner,
      startedBy: "finder",
      lostAt: tag.status === "lost" ? tag.lostAt : null,
      foundAt: now,
    });
  } else if (!incident.foundAt) {
    incident.foundAt = now;
    await incident.save();
  }
  if (tag.status !== "found") {
    Object.assign(tag, { status: "found", foundAt: now });
    await tag.save();
  }
  return incident;
}

export async function markReturned(tag) {
  const now = new Date();
  await closeIncident(tag, "recovered", now);
  await closeOpenReports(tag, RETURNED_MESSAGE, now);
  Object.assign(tag, { status: "returned", returnedAt: now });
  await tag.save();
}

// False alarm, disabling, or reassignment: the incident doesn't count as a recovery
export async function cancelIncident(tag, nextStatus) {
  await closeIncident(tag, "cancelled");
  Object.assign(tag, { status: nextStatus, lostAt: null, foundAt: null });
  await tag.save();
}

// After a report is closed or marked spam: undo the "found" status it caused,
// unless another open report still backs it up
export async function revertFoundIfUnsupported(tag) {
  if (tag.status !== "found") return;
  if (await Report.exists({ tag: tag._id, owner: tag.owner, status: "open" })) return;

  const incident = await findOpenIncident(tag);
  if (incident?.lostAt) {
    incident.foundAt = null;
    await incident.save();
    Object.assign(tag, { status: "lost", foundAt: null });
    await tag.save();
  } else {
    await cancelIncident(tag, "active");
  }
}
