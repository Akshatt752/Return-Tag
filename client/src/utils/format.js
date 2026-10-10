// Tag codes are 10 characters; shown as two groups of five so they're easy to read aloud
export function normalizeCode(value = "") {
  return String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export function formatCode(value = "") {
  const code = normalizeCode(value);
  return code.length > 5 ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

const UNITS = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function timeAgo(date) {
  if (!date) return "";
  const seconds = Math.round((new Date(date).getTime() - Date.now()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function formatDate(date, withTime = false) {
  if (!date) return "";
  return new Date(date).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

// 0.4 h -> "24 min", 5.2 h -> "5.2 h", 50 h -> "2.1 days"
export function hours(value) {
  if (value === null || value === undefined) return "—";
  if (value < 1) return `${Math.max(1, Math.round(value * 60))} min`;
  if (value < 48) return `${Number(value.toFixed(1))} h`;
  return `${Number((value / 24).toFixed(1))} days`;
}

export function percent(value) {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

// 1284 -> "1,284", 12900 -> "12.9K"
export function compact(value) {
  if (value === null || value === undefined) return "—";
  if (value < 10000) return value.toLocaleString();
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function monthLabel(month) {
  // "2026-05" -> "May"
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "short" });
}
