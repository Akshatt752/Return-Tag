import { tagUrl } from "./codes.js";

// Response shapes from docs/API.md. Everything sent to a client goes through one of
// these, so secret fields (hashes, encrypted contacts, IP hashes) can't leak by accident.

const hours = (ms) => (ms == null ? null : Math.round((ms / 36e5) * 10) / 10);

export function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    plan: user.plan,
    tagLimit: user.tagLimit(),
    notify: { email: user.notify?.email !== false, push: user.notify?.push !== false },
  };
}

export function serializeTag(tag, { openReports = 0, unread = 0 } = {}) {
  const { transfer } = tag;
  const pendingTransfer =
    transfer?.toEmail && transfer.expiresAt > new Date()
      ? { toEmail: transfer.toEmail, expiresAt: transfer.expiresAt }
      : null;

  return {
    id: tag._id,
    code: tag.code,
    url: tagUrl(tag.code),
    item: { name: tag.item?.name ?? "", category: tag.item?.category ?? "other", description: tag.item?.description ?? "" },
    publicLabel: tag.publicLabel,
    publicMessage: tag.publicMessage,
    rewardOffered: tag.rewardOffered,
    status: tag.status,
    lostAt: tag.lostAt,
    foundAt: tag.foundAt,
    returnedAt: tag.returnedAt,
    scanCount: tag.scanCount,
    lastScannedAt: tag.lastScannedAt,
    openReports,
    unread,
    pendingTransfer,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
  };
}

// `tag` is the live tag document (or null). Live details are shown only while the tag
// still belongs to the report's owner; after a transfer the report shows what the finder saw.
export function serializeReportSummary(report, tag) {
  const owned = Boolean(tag && String(tag.owner) === String(report.owner));
  const snapshot = report.tagSnapshot || {};
  const location = report.location;

  return {
    id: report._id,
    status: report.status,
    tag: {
      id: owned ? tag._id : null,
      code: snapshot.code,
      publicLabel: (owned ? tag.publicLabel : snapshot.publicLabel) || "An item",
      category: (owned ? tag.item?.category : snapshot.category) || "other",
      status: owned ? tag.status : null,
    },
    alias: report.alias,
    excerpt: report.lastExcerpt,
    hasLocation: Boolean(location && (location.text || location.lat != null)),
    hasPhoto: report.hasPhoto,
    ownerUnread: report.ownerUnread,
    lastMessageAt: report.lastMessageAt,
    createdAt: report.createdAt,
  };
}

export function serializeReportDetail(report, tag) {
  const location = report.location;
  return {
    ...serializeReportSummary(report, tag),
    location:
      location && (location.text || location.lat != null)
        ? { text: location.text, lat: location.lat, lng: location.lng, precision: location.precision }
        : null,
  };
}

export const serializeMessage = (message) => ({
  id: message._id,
  sender: message.sender,
  body: message.body,
  createdAt: message.createdAt,
});

export const serializeIncident = (incident) => ({
  id: incident._id,
  status: incident.status,
  startedBy: incident.startedBy,
  lostAt: incident.lostAt,
  foundAt: incident.foundAt,
  closedAt: incident.closedAt,
  hours: hours(incident.durationMs),
});

export { hours };
