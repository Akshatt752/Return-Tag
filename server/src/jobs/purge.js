import Report from "../models/Report.js";
import Photo from "../models/Photo.js";
import Tag from "../models/Tag.js";

// Data minimisation: once a conversation has been closed for 30 days, delete everything
// that could identify or locate the finder. The messages themselves stay for the owner.
export const RETENTION_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export async function purgeStaleData(now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * DAY);
  const stale = await Report.find({ status: { $ne: "open" }, resolvedAt: { $lte: cutoff }, purgedAt: null }).select("_id");
  const ids = stale.map((report) => report._id);

  if (ids.length) {
    await Report.updateMany(
      { _id: { $in: ids } },
      {
        $set: { location: null, hasPhoto: false, finderEmailEnc: null, finderTokenEnc: null, ipHash: null, purgedAt: now },
      },
      { timestamps: false }
    );
    await Photo.deleteMany({ report: { $in: ids } });
  }

  // Expired transfer links
  await Tag.updateMany(
    { "transfer.expiresAt": { $lte: now } },
    { $set: { "transfer.toEmail": null, "transfer.expiresAt": null, "transfer.tokenHash": null } },
    { timestamps: false }
  );

  return { purgedReports: ids.length };
}

export function startPurgeJob() {
  const run = () =>
    purgeStaleData()
      .then(({ purgedReports }) => purgedReports && console.log(`Purged finder data from ${purgedReports} old reports`))
      .catch((err) => console.error("Purge job failed:", err.message));

  run();
  // unref so the timer never keeps the process alive on its own
  setInterval(run, 6 * 60 * 60 * 1000).unref();
}
