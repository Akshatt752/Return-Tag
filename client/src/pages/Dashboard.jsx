import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageSquare, Plus, QrCode, Tag } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import { useAuth } from "../context/auth";
import { compact, hours, percent, timeAgo } from "../utils/format";
import StatTile from "../components/StatTile";
import MonthlyChart from "../components/MonthlyChart";
import TagCard from "../components/TagCard";
import CategoryIcon from "../components/CategoryIcon";
import { ErrorNote } from "../components/ErrorNote";
import { PageSpinner } from "../components/Spinner";

function OpenReports({ reports }) {
  return (
    <section className="sheet flex flex-col p-4 sm:p-5" aria-labelledby="open-reports">
      <div className="flex items-center justify-between">
        <h2 id="open-reports" className="text-sm font-medium">
          Open reports
        </h2>
        <Link to="/inbox" className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink">
          Inbox <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      {reports.length === 0 ? (
        <p className="m-auto py-8 text-center text-sm text-ink-3">
          No open reports. When someone scans one of your tags, it shows up here.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {reports.slice(0, 5).map((r) => (
            <li key={r.id}>
              <Link to={`/inbox/${r.id}`} className="flex items-center gap-3 py-3 transition hover:opacity-80">
                <CategoryIcon category={r.tag?.category} boxClassName="size-9" className="size-4" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{r.tag?.publicLabel}</span>
                    {r.ownerUnread > 0 && (
                      <span className="rounded-full bg-accent px-1.5 font-mono text-[10px] leading-4 font-semibold text-white dark:text-paper">
                        {r.ownerUnread}
                        <span className="sr-only"> unread</span>
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-ink-3">
                    {r.alias}: {r.excerpt}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-ink-3">{timeAgo(r.lastMessageAt || r.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyTags() {
  return (
    <div className="sheet flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-lg bg-tag text-[#191917]">
        <Tag className="size-7" aria-hidden="true" />
      </span>
      <h2 className="heading mt-5 text-2xl">Tag your first item</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-2">
        Start with whatever you'd miss most: keys, laptop, backpack. You'll get a QR code to print or stick on.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link to="/tags/new" className="btn-primary">
          <Plus className="size-4" aria-hidden="true" />
          New tag
        </Link>
        <Link to="/claim" className="btn-secondary">
          <QrCode className="size-4" aria-hidden="true" />
          Claim a pre-printed tag
        </Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [tags, setTags] = useState(null);
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [t, s, r] = await Promise.all([api.get("/tags"), api.get("/stats/me"), api.get("/reports?status=open")]);
      setTags(t.data.tags);
      setStats(s.data);
      setReports(r.data.reports);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!tags || !stats) {
    return error ? (
      <div className="container-page py-12">
        <ErrorNote>{error}</ErrorNote>
      </div>
    ) : (
      <PageSpinner />
    );
  }

  const firstName = user?.name?.split(" ")[0] || "there";
  const limited = user?.tagLimit !== null && user?.tagLimit !== undefined;
  const missing = stats.tags.lost + stats.tags.found;

  return (
    <div className="container-page py-10 sm:py-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="heading mt-2 text-3xl sm:text-4xl">Hi, {firstName}</h1>
          <p className="mt-2 text-sm text-ink-2">
            {missing > 0
              ? `${missing} ${missing === 1 ? "item needs" : "items need"} your attention.`
              : "Everything's where it should be."}
            {limited && (
              <span className="text-ink-3">
                {" "}
                · {stats.tags.total} of {user.tagLimit} tags ({user.plan} plan)
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/claim" className="btn-secondary">
            <QrCode className="size-4" aria-hidden="true" />
            Claim a tag
          </Link>
          <Link to="/tags/new" className="btn-primary">
            <Plus className="size-4" aria-hidden="true" />
            New tag
          </Link>
        </div>
      </div>

      {tags.length === 0 ? (
        <div className="mt-10">
          <EmptyTags />
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Tags"
              value={compact(stats.tags.total)}
              note={`${stats.tags.lost} lost · ${stats.tags.found} found`}
            />
            <StatTile
              label="Recovery rate"
              value={percent(stats.recoveryRate)}
              note={`${stats.incidents.recovered} of ${stats.incidents.recovered + stats.incidents.open} missing items · false alarms excluded`}
            />
            <StatTile label="Average time to recover" value={hours(stats.avgRecoveryHours)} note="From lost or found to returned" />
            <StatTile label="Scans" value={compact(stats.scans)} note={`${stats.reports.total} finder ${stats.reports.total === 1 ? "report" : "reports"}`} />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <MonthlyChart data={stats.monthly} />
            <OpenReports reports={reports} />
          </div>

          <section className="mt-10" aria-labelledby="tags-heading">
            <div className="flex items-center justify-between">
              <h2 id="tags-heading" className="heading text-2xl">
                Your tags
              </h2>
              {stats.reports.unread > 0 && (
                <Link to="/inbox" className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
                  <MessageSquare className="size-4" aria-hidden="true" />
                  {stats.reports.unread} unread
                </Link>
              )}
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tags.map((tag) => (
                <li key={tag.id}>
                  <TagCard tag={tag} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
