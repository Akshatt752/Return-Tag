// Reports a finder sent from this device, so they can get back to the conversation
// without an account. Each entry holds the private token for that one report.
const KEY = "rt:finderReports";

export function listFinderReports() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveFinderReport(entry) {
  try {
    const rest = listFinderReports().filter((r) => r.reportId !== entry.reportId);
    localStorage.setItem(KEY, JSON.stringify([entry, ...rest].slice(0, 20)));
  } catch {
    // Storage blocked: the URL fragment still carries the token for this visit
  }
}

export function findFinderToken(reportId) {
  return listFinderReports().find((r) => r.reportId === reportId)?.token || null;
}

export function forgetFinderReport(reportId) {
  try {
    localStorage.setItem(KEY, JSON.stringify(listFinderReports().filter((r) => r.reportId !== reportId)));
  } catch {
    // Nothing to remove
  }
}
