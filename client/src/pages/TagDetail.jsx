import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowLeftRight,
  Ban,
  Check,
  CircleCheck,
  Copy,
  Download,
  MessageSquare,
  Printer,
  RotateCcw,
  ScanLine,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import { copyText, downloadSvgAsPng, downloadText } from "../utils/download";
import { formatCode, formatDate, hours, timeAgo } from "../utils/format";
import { EMPTY_TAG, toForm } from "../utils/tagForm";
import useQrSvg from "../hooks/useQrSvg";
import CategoryIcon from "../components/CategoryIcon";
import StatusPill from "../components/StatusPill";
import TagForm from "../components/TagForm";
import { ErrorNote, OkNote } from "../components/ErrorNote";
import Spinner, { PageSpinner } from "../components/Spinner";
import NotFound from "./NotFound";

const STATUS_HELP = {
  active: "Safe with you. Anyone who scans it can still message you.",
  lost: "Finders who scan it see that you've reported it lost.",
  found: "Someone reported finding it. Arrange the return in your inbox.",
  returned: "Back with you. Mark it lost again if it goes missing.",
  disabled: "Turned off. Scans show the tag isn't active and no reports can be sent.",
};

// Buttons for each status, following the allowed transitions in docs/API.md
function actionsFor(status) {
  switch (status) {
    case "active":
      return [{ to: "lost", label: "Mark as lost", icon: TriangleAlert, style: "btn-danger" }];
    case "returned":
      return [
        { to: "lost", label: "Mark as lost", icon: TriangleAlert, style: "btn-danger" },
        { to: "active", label: "Clear returned badge", icon: Undo2, style: "btn-secondary" },
      ];
    case "lost":
      return [
        { to: "returned", label: "I got it back", icon: CircleCheck, style: "btn-accent" },
        { to: "active", label: "False alarm", icon: Undo2, style: "btn-secondary" },
      ];
    case "found":
      return [{ to: "returned", label: "Item returned", icon: CircleCheck, style: "btn-accent" }];
    case "disabled":
      return [{ to: "active", label: "Reactivate tag", icon: RotateCcw, style: "btn-primary" }];
    default:
      return [];
  }
}

function QrPanel({ tag }) {
  const svg = useQrSvg(tag.url);
  const [copied, setCopied] = useState(false);
  const file = `returntag-${tag.code}`;

  const copy = async () => {
    if (await copyText(tag.url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <section className="sheet p-5" aria-labelledby="qr-heading">
      <h2 id="qr-heading" className="sr-only">
        QR code
      </h2>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start lg:flex-col lg:items-center">
        <div
          role="img"
          aria-label={`QR code for tag ${formatCode(tag.code)}`}
          className="size-48 shrink-0 overflow-hidden rounded-md border border-line bg-white p-2 [&>svg]:block [&>svg]:size-full"
          dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
        />
        <div className="w-full min-w-0 text-center sm:text-left lg:text-center">
          <p className="code text-xl text-ink">{formatCode(tag.code)}</p>
          <button
            type="button"
            onClick={copy}
            className="mt-1 inline-flex max-w-full items-center gap-1.5 text-xs text-ink-3 hover:text-ink"
            title="Copy link"
          >
            <span className="truncate">{tag.url}</span>
            {copied ? <Check className="size-3.5 shrink-0 text-returned" aria-hidden="true" /> : <Copy className="size-3.5 shrink-0" aria-hidden="true" />}
            <span className="sr-only">{copied ? "Copied" : "Copy link"}</span>
          </button>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={!svg}
              onClick={() => downloadText(svg, `${file}.svg`, "image/svg+xml")}
            >
              <Download className="size-3.5" aria-hidden="true" />
              SVG
            </button>
            <button type="button" className="btn-secondary btn-sm" disabled={!svg} onClick={() => downloadSvgAsPng(svg, `${file}.png`)}>
              <Download className="size-3.5" aria-hidden="true" />
              PNG
            </button>
            <Link to={`/tags/${tag.id}/print`} className="btn-primary btn-sm col-span-2">
              <Printer className="size-3.5" aria-hidden="true" />
              Print stickers
            </Link>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-ink-3 sm:justify-start lg:justify-center">
            <ScanLine className="size-3.5" aria-hidden="true" />
            Scanned {tag.scanCount ?? 0} {tag.scanCount === 1 ? "time" : "times"}
            {tag.lastScannedAt && ` · last ${timeAgo(tag.lastScannedAt)}`}
          </p>
        </div>
      </div>
    </section>
  );
}

function StatusPanel({ tag, onChange }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const change = async (status) => {
    if (status === "disabled" && !window.confirm("Disable this tag? Finders won't be able to send reports until you reactivate it.")) {
      return;
    }
    setError("");
    setBusy(status);
    try {
      await api.post(`/tags/${tag.id}/status`, { status });
      await onChange();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy("");
    }
  };

  const actions = actionsFor(tag.status);

  return (
    <section className="sheet p-5" aria-labelledby="status-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="status-heading" className="text-sm font-medium">
          Status
        </h2>
        <StatusPill status={tag.status} />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{STATUS_HELP[tag.status]}</p>
      <ErrorNote className="mt-3">{error}</ErrorNote>
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map(({ to, label, icon: Icon, style }) => (
          <button key={to + label} type="button" className={`${style} btn-sm`} disabled={Boolean(busy)} onClick={() => change(to)}>
            {busy === to ? <Spinner className="size-3.5" /> : <Icon className="size-3.5" aria-hidden="true" />}
            {label}
          </button>
        ))}
        {tag.status !== "disabled" && (
          <button type="button" className="btn-secondary btn-sm text-ink-2" disabled={Boolean(busy)} onClick={() => change("disabled")}>
            {busy === "disabled" ? <Spinner className="size-3.5" /> : <Ban className="size-3.5" aria-hidden="true" />}
            Disable
          </button>
        )}
      </div>
    </section>
  );
}

function TagReports({ reports }) {
  return (
    <section className="sheet p-5" aria-labelledby="tag-reports">
      <h2 id="tag-reports" className="text-sm font-medium">
        Finder reports
      </h2>
      {reports.length === 0 ? (
        <p className="mt-2 text-sm text-ink-3">No one has reported finding this item yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {reports.map((r) => (
            <li key={r.id}>
              <Link to={`/inbox/${r.id}`} className="flex items-center gap-3 py-3 transition hover:opacity-80">
                <MessageSquare className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {r.alias}
                    {r.ownerUnread > 0 && (
                      <span className="rounded-full bg-accent px-1.5 font-mono text-[10px] leading-4 text-white dark:text-paper">
                        {r.ownerUnread}
                        <span className="sr-only"> unread</span>
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-ink-3">{r.excerpt}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <StatusPill status={r.status} />
                  <span className="text-[11px] text-ink-3">{timeAgo(r.lastMessageAt || r.createdAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Incidents({ incidents }) {
  if (!incidents.length) return null;
  return (
    <section className="sheet p-5" aria-labelledby="incidents-heading">
      <h2 id="incidents-heading" className="text-sm font-medium">
        History
      </h2>
      <ol className="mt-4 space-y-4 border-l border-line pl-5">
        {incidents.map((inc) => {
          const dot =
            inc.status === "recovered" ? "bg-returned" : inc.status === "open" ? "bg-lost" : "bg-line-strong";
          return (
            <li key={inc.id} className="relative">
              <span className={`absolute top-1.5 -left-[25px] size-2.5 rounded-full ring-4 ring-card ${dot}`} aria-hidden="true" />
              <p className="text-sm font-medium">
                {inc.status === "recovered" && `Recovered${inc.hours !== null ? ` in ${hours(inc.hours)}` : ""}`}
                {inc.status === "open" && "Currently missing"}
                {inc.status === "cancelled" && "False alarm"}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
                {inc.lostAt && `Reported lost ${formatDate(inc.lostAt, true)}`}
                {inc.lostAt && inc.foundAt && " · "}
                {inc.foundAt && `Found ${formatDate(inc.foundAt, true)}${inc.startedBy === "finder" ? " by a finder" : ""}`}
                {inc.closedAt && ` · Closed ${formatDate(inc.closedAt, true)}`}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function TransferPanel({ tag, onChange }) {
  const [email, setEmail] = useState("");
  const [transferUrl, setTransferUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const pending = tag.pendingTransfer;

  const start = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post(`/tags/${tag.id}/transfer`, { email: email.trim() });
      setTransferUrl(data.transferUrl);
      setEmail("");
      await onChange();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setError("");
    setBusy(true);
    try {
      await api.delete(`/tags/${tag.id}/transfer`);
      setTransferUrl("");
      await onChange();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (await copyText(transferUrl)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <section className="sheet p-5" aria-labelledby="transfer-heading">
      <h2 id="transfer-heading" className="flex items-center gap-2 text-sm font-medium">
        <ArrowLeftRight className="size-4 text-ink-3" aria-hidden="true" />
        Transfer to someone else
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Selling or giving the item away? The new owner takes over the tag. Your conversations stay with you and are
        closed, and they never see them.
      </p>
      <ErrorNote className="mt-3">{error}</ErrorNote>

      {pending ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-md bg-muted px-3.5 py-2.5 text-sm">
            Waiting for <strong className="font-medium break-all">{pending.toEmail}</strong> to accept · expires{" "}
            {formatDate(pending.expiresAt)}
          </p>
          {transferUrl && (
            <div>
              <p className="text-xs text-ink-3">We emailed this link. You can also send it yourself:</p>
              <div className="mt-1.5 flex gap-2">
                <input className="input font-mono text-xs sm:text-xs" readOnly value={transferUrl} aria-label="Transfer link" onFocus={(e) => e.target.select()} />
                <button type="button" className="btn-secondary btn-sm shrink-0" onClick={copy}>
                  {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
          <button type="button" className="btn-secondary btn-sm" onClick={cancel} disabled={busy}>
            {busy ? <Spinner className="size-3.5" /> : "Cancel transfer"}
          </button>
        </div>
      ) : (
        <form onSubmit={start} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="transfer-email" className="sr-only">
            New owner's email
          </label>
          <input
            id="transfer-email"
            type="email"
            className="input"
            placeholder="New owner's email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit" className="btn-secondary shrink-0" disabled={busy}>
            {busy ? <Spinner className="size-4" /> : "Send transfer link"}
          </button>
        </form>
      )}
    </section>
  );
}

function RelinkPanel({ tag, onChange }) {
  const [done, setDone] = useState(false);
  const relink = async (payload) => {
    await api.post(`/tags/${tag.id}/relink`, payload);
    setDone(true);
    await onChange();
  };

  return (
    <details className="sheet group p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
        <RotateCcw className="size-4 text-ink-3" aria-hidden="true" />
        Use this sticker on a different item
        <span className="ml-auto text-xs text-ink-3 group-open:hidden">Show</span>
      </summary>
      <div className="mt-4">
        <OkNote className="mb-4">{done ? "Relinked. The same QR now points to the new item." : ""}</OkNote>
        <p className="alert-error mb-6">
          The printed QR stays the same, but every open report on this tag is closed and the status resets to safe.
        </p>
        <TagForm key={tag.updatedAt} initial={EMPTY_TAG} submitLabel="Relink tag" onSubmit={relink} idPrefix="relink" />
      </div>
    </details>
  );
}

export default function TagDetail() {
  const { id } = useParams();
  const location = useLocation();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/tags/${id}`);
      setDetail(data);
      setError("");
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 400) setMissing(true);
      else setError(getErrorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (missing) return <NotFound title="Tag not found." note="It may have been transferred to someone else." />;
  if (!detail) {
    return error ? (
      <div className="container-page py-12">
        <ErrorNote>{error}</ErrorNote>
      </div>
    ) : (
      <PageSpinner />
    );
  }

  const { tag, reports = [], incidents = [] } = detail;

  const save = async (payload) => {
    setSaved(false);
    const { data } = await api.patch(`/tags/${tag.id}`, payload);
    setDetail((d) => ({ ...d, tag: data.tag }));
    setSaved(true);
  };

  const needsDetails = !tag.publicLabel || !tag.item?.name;

  return (
    <div className="container-page py-10 sm:py-12">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Dashboard
      </Link>

      <div className="mt-5 flex items-start gap-4">
        <CategoryIcon category={tag.item?.category} boxClassName="size-12" className="size-6" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="heading text-3xl break-words sm:text-4xl">{tag.publicLabel || "New tag"}</h1>
            <StatusPill status={tag.status} />
          </div>
          <p className="mt-1 text-sm text-ink-3">
            {tag.item?.name || "No item details yet"} · created {formatDate(tag.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <OkNote>{location.state?.created ? "Tag created. Print the stickers or download the QR code to attach it." : ""}</OkNote>
        {needsDetails && (
          <p className="alert-error">
            This tag was claimed but has no item details yet. Fill in the form below so finders know what they've found.
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <QrPanel tag={tag} />
        </div>
        <div className="min-w-0 space-y-4">
          <StatusPanel tag={tag} onChange={load} />
          <TagReports reports={reports} />
          <Incidents incidents={incidents} />
        </div>
      </div>

      <section className="sheet mt-4 p-5 sm:p-6" aria-labelledby="edit-heading">
        <h2 id="edit-heading" className="heading text-xl">
          Item details
        </h2>
        <div className="mt-6">
          <TagForm
            key={tag.updatedAt}
            initial={toForm(tag)}
            submitLabel="Save changes"
            onSubmit={save}
            idPrefix="edit"
            extra={<OkNote>{saved ? "Saved." : ""}</OkNote>}
          />
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:items-start">
        <TransferPanel tag={tag} onChange={load} />
        <RelinkPanel tag={tag} onChange={load} />
      </div>
    </div>
  );
}
