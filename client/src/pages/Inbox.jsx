import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ImageIcon, MapPin, MessageSquare } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import { formatCode, timeAgo } from "../utils/format";
import CategoryIcon from "../components/CategoryIcon";
import StatusPill from "../components/StatusPill";
import { ErrorNote } from "../components/ErrorNote";
import Spinner from "../components/Spinner";
import usePolling from "../hooks/usePolling";

const FILTERS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "spam", label: "Spam" },
  { value: "all", label: "All" },
];

export default function Inbox() {
  const [params, setParams] = useSearchParams();
  const status = FILTERS.some((f) => f.value === params.get("status")) ? params.get("status") : "open";
  const [result, setResult] = useState({ status: null, reports: [] });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/reports?status=${status}`);
      // Unread first, then most recent activity
      const sorted = [...data.reports].sort(
        (a, b) =>
          (b.ownerUnread > 0) - (a.ownerUnread > 0) ||
          new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt)
      );
      setResult({ status, reports: sorted });
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  // Until the current filter's first response arrives, show the spinner rather than the old list
  const reports = result.status === status ? result.reports : null;

  usePolling(load, 20000, reports !== null);

  return (
    <div className="container-page py-10 sm:py-12">
      <p className="eyebrow">Inbox</p>
      <h1 className="heading mt-2 text-3xl sm:text-4xl">Finder reports</h1>
      <p className="mt-2 text-sm text-ink-2">Each report is a private conversation with whoever found your item.</p>

      <div className="mt-6 flex gap-1 overflow-x-auto rounded-md border border-line p-0.5 sm:w-fit" role="group" aria-label="Filter reports">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            aria-pressed={status === f.value}
            onClick={() => setParams(f.value === "open" ? {} : { status: f.value })}
            className={`rounded-[5px] px-3.5 py-1.5 text-sm transition ${
              status === f.value ? "bg-muted font-medium text-ink" : "text-ink-3 hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ErrorNote className="mt-4">{error}</ErrorNote>

      {reports === null ? (
        !error && (
          <div className="py-16 text-center text-ink-3">
            <Spinner className="size-5" />
          </div>
        )
      ) : reports.length === 0 ? (
        <div className="sheet mt-6 px-6 py-14 text-center">
          <MessageSquare className="mx-auto size-7 text-ink-3" aria-hidden="true" />
          <p className="mt-3 text-sm text-ink-2">
            {status === "open" ? "No open reports. Fingers crossed it stays that way." : "Nothing here."}
          </p>
        </div>
      ) : (
        <ul className="sheet mt-6 divide-y divide-line">
          {reports.map((r) => (
            <li key={r.id}>
              <Link to={`/inbox/${r.id}`} className="flex items-start gap-3 p-4 transition hover:bg-muted/50 sm:items-center">
                <CategoryIcon category={r.tag?.category} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`truncate ${r.ownerUnread > 0 ? "font-semibold" : "font-medium"}`}>{r.tag?.publicLabel}</span>
                    <span className="code text-[11px] text-ink-3">{formatCode(r.tag?.code)}</span>
                  </div>
                  <p className={`mt-0.5 truncate text-sm ${r.ownerUnread > 0 ? "text-ink" : "text-ink-3"}`}>
                    <span className="text-ink-2">{r.alias}:</span> {r.excerpt}
                  </p>
                  <p className="mt-1 flex items-center gap-3 text-[11px] text-ink-3">
                    {r.hasLocation && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden="true" /> Location
                      </span>
                    )}
                    {r.hasPhoto && (
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon className="size-3" aria-hidden="true" /> Photo
                      </span>
                    )}
                    <span>{timeAgo(r.lastMessageAt || r.createdAt)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {status === "all" && <StatusPill status={r.status} />}
                  {r.ownerUnread > 0 && (
                    <span className="rounded-full bg-accent px-2 font-mono text-[11px] leading-5 font-semibold text-white dark:text-paper">
                      {r.ownerUnread}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
