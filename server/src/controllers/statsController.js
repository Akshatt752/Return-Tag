import mongoose from "mongoose";
import Tag from "../models/Tag.js";
import Report from "../models/Report.js";
import Incident from "../models/Incident.js";
import { hours } from "../utils/serialize.js";

// Counts incidents by status for any filter (one owner, or everyone).
// Recovery rate ignores cancelled incidents (false alarms).
export async function incidentSummary(match = {}) {
  const rows = await Incident.aggregate([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 }, avgMs: { $avg: "$durationMs" } } },
  ]);
  const by = Object.fromEntries(rows.map((row) => [row._id, row]));
  const recovered = by.recovered?.count ?? 0;
  const open = by.open?.count ?? 0;
  const cancelled = by.cancelled?.count ?? 0;
  const counted = recovered + open;

  return {
    total: recovered + open + cancelled,
    recovered,
    cancelled,
    open,
    recoveryRate: counted ? Math.round((recovered / counted) * 100) / 100 : null,
    avgRecoveryHours: hours(by.recovered?.avgMs ?? null),
  };
}

export async function tagStatusCounts(match = {}) {
  const rows = await Tag.aggregate([
    { $match: match },
    { $group: { _id: "$status", count: { $sum: 1 }, scans: { $sum: "$scanCount" } } },
  ]);
  const counts = { total: 0, unclaimed: 0, active: 0, lost: 0, found: 0, returned: 0, disabled: 0 };
  let scans = 0;
  for (const row of rows) {
    counts[row._id] = row.count;
    counts.total += row.count;
    scans += row.scans;
  }
  return { counts, scans };
}

// Last six calendar months (UTC), oldest first, with zero-filled gaps
async function monthlyActivity(owner) {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const monthOf = (field) => ({ $dateToString: { format: "%Y-%m", date: field } });

  const [started, recovered] = await Promise.all([
    Incident.aggregate([
      { $match: { owner, createdAt: { $gte: since } } },
      { $group: { _id: monthOf("$createdAt"), count: { $sum: 1 } } },
    ]),
    Incident.aggregate([
      { $match: { owner, status: "recovered", closedAt: { $gte: since } } },
      { $group: { _id: monthOf("$closedAt"), count: { $sum: 1 } } },
    ]),
  ]);
  const lostBy = new Map(started.map((row) => [row._id, row.count]));
  const recoveredBy = new Map(recovered.map((row) => [row._id, row.count]));

  return Array.from({ length: 6 }, (_, i) => {
    const month = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1)).toISOString().slice(0, 7);
    return { month, lost: lostBy.get(month) ?? 0, recovered: recoveredBy.get(month) ?? 0 };
  });
}

export async function myStats(req, res) {
  const owner = new mongoose.Types.ObjectId(String(req.user._id));

  const [tagStats, reportRows, incidents, monthly, recent] = await Promise.all([
    tagStatusCounts({ owner }),
    Report.aggregate([
      { $match: { owner } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } },
          unread: { $sum: { $cond: [{ $eq: ["$status", "open"] }, "$ownerUnread", 0] } },
        },
      },
    ]),
    incidentSummary({ owner }),
    monthlyActivity(owner),
    Incident.find({ owner, status: "recovered" }).sort({ closedAt: -1 }).limit(5).populate("tag", "publicLabel owner"),
  ]);

  const tags = { ...tagStats.counts };
  delete tags.unclaimed; // never applies to an owner
  const reports = reportRows[0] ?? { total: 0, open: 0, unread: 0 };

  res.json({
    tags,
    scans: tagStats.scans,
    reports: { total: reports.total, open: reports.open, unread: reports.unread },
    incidents: { total: incidents.total, recovered: incidents.recovered, cancelled: incidents.cancelled, open: incidents.open },
    recoveryRate: incidents.recoveryRate,
    avgRecoveryHours: incidents.avgRecoveryHours,
    monthly,
    recent: recent.map((incident) => ({
      // Link only to tags the user still owns
      tagId: incident.tag && String(incident.tag.owner) === String(owner) ? incident.tag._id : null,
      publicLabel: incident.tag?.publicLabel || "An item",
      closedAt: incident.closedAt,
      hours: hours(incident.durationMs),
    })),
  });
}

// Landing-page counters, cached briefly because every visitor requests them
let publicCache = { at: 0, data: null };

export async function publicStats(req, res) {
  if (publicCache.data && Date.now() - publicCache.at < 60 * 1000) return res.json(publicCache.data);

  const [tagsProtected, incidents, reportsSent] = await Promise.all([
    Tag.countDocuments({ status: { $in: ["active", "lost", "found", "returned"] } }),
    incidentSummary(),
    Report.countDocuments({ status: { $ne: "spam" } }),
  ]);

  publicCache = {
    at: Date.now(),
    data: { tagsProtected, itemsReturned: incidents.recovered, avgRecoveryHours: incidents.avgRecoveryHours, reportsSent },
  };
  res.json(publicCache.data);
}

export const clearPublicStatsCache = () => {
  publicCache = { at: 0, data: null };
};
