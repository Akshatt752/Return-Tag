import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Ban, CircleCheck, ImageOff, LockKeyhole, MapPin, RotateCcw, X } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import { formatCode, formatDate } from "../utils/format";
import ChatThread from "../components/ChatThread";
import CategoryIcon from "../components/CategoryIcon";
import StatusPill from "../components/StatusPill";
import { ErrorNote } from "../components/ErrorNote";
import Spinner, { PageSpinner } from "../components/Spinner";
import usePolling from "../hooks/usePolling";
import NotFound from "./NotFound";

function osmLink({ lat, lng }) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

// The photo needs the auth header, so it's fetched as a blob instead of a plain <img src>
function ReportPhoto({ reportId }) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    api
      .get(`/reports/${reportId}/photo`, { responseType: "blob" })
      .then(({ data }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reportId]);

  if (failed) {
    return (
      <p className="flex items-center gap-2 text-xs text-ink-3">
        <ImageOff className="size-4" aria-hidden="true" />
        The photo is no longer available.
      </p>
    );
  }
  if (!url) return <Spinner className="size-4" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt="Photo sent by the finder" className="max-h-72 w-full rounded-md border border-line object-cover" />
    </a>
  );
}

function Actions({ report, onAction }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const run = async (action) => {
    if (
      action === "spam" &&
      !window.confirm("Mark this as spam? The sender will be blocked from reporting any of your tags.")
    ) {
      return;
    }
    setError("");
    setBusy(action);
    try {
      await onAction(action);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy("");
    }
  };

  const button = (action, label, Icon, style) => (
    <button type="button" className={`${style} btn-sm w-full`} onClick={() => run(action)} disabled={Boolean(busy)}>
      {busy === action ? <Spinner className="size-3.5" /> : <Icon className="size-3.5" aria-hidden="true" />}
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <ErrorNote>{error}</ErrorNote>
      {report.status === "open" ? (
        <>
          {button("returned", "Item returned", CircleCheck, "btn-accent")}
          {button("close", "Close conversation", X, "btn-secondary")}
          {button("spam", "Mark spam & block", Ban, "btn-danger")}
        </>
      ) : (
        button("reopen", "Reopen conversation", RotateCcw, "btn-secondary")
      )}
    </div>
  );
}

export default function OwnerChat() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/reports/${id}`);
      setReport(data.report);
      setMessages(data.messages);
      setError("");
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 400) setMissing(true);
      else setError(getErrorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  usePolling(load, 10000, Boolean(report));

  const send = async (body) => {
    const { data } = await api.post(`/reports/${id}/messages`, { body });
    setMessages((list) => [...list, data.message]);
  };

  const act = async (action) => {
    await api.patch(`/reports/${id}`, { action });
    await load();
  };

  if (missing) return <NotFound title="Conversation not found." note="It may belong to a tag you've transferred." />;
  if (!report) {
    return error ? (
      <div className="container-page py-12">
        <ErrorNote>{error}</ErrorNote>
      </div>
    ) : (
      <PageSpinner />
    );
  }

  const loc = report.location;
  const hasCoords = loc && typeof loc.lat === "number" && typeof loc.lng === "number";
  const closedNote =
    report.status === "spam"
      ? "Marked as spam. The sender is blocked."
      : report.status === "resolved"
        ? "This conversation is closed. Reopen it to keep chatting."
        : null;

  return (
    <div className="container-page py-10 sm:py-12">
      <Link to="/inbox" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Inbox
      </Link>

      <div className="mt-5 flex items-start gap-3">
        <CategoryIcon category={report.tag?.category} boxClassName="size-12" className="size-6" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="heading truncate text-2xl sm:text-3xl">{report.tag?.publicLabel}</h1>
            <StatusPill status={report.status} />
          </div>
          <p className="mt-1 text-sm text-ink-3">
            Reported by <span className="text-ink-2">{report.alias}</span> · {formatDate(report.createdAt, true)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="min-w-0">
          <ErrorNote className="mb-3">{error}</ErrorNote>
          <ChatThread
            messages={messages}
            me="owner"
            otherName={report.alias || "Finder"}
            onSend={send}
            closedNote={closedNote}
            placeholder={`Reply to ${report.alias || "the finder"}…`}
          />
          <p className="mt-3 flex gap-2 text-xs leading-relaxed text-ink-3">
            <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            The finder sees you only as “Owner”. Share a phone number or meeting place only if you're comfortable; a
            public spot like a reception desk is safest.
          </p>
        </div>

        <aside className="space-y-4">
          <section className="sheet p-4" aria-labelledby="item-heading">
            <h2 id="item-heading" className="eyebrow">
              Item
            </h2>
            <Link to={`/tags/${report.tag?.id}`} className="mt-3 flex items-center justify-between gap-2 hover:opacity-80">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{report.tag?.publicLabel}</span>
                <span className="code block text-xs text-ink-3">{formatCode(report.tag?.code)}</span>
              </span>
              <StatusPill status={report.tag?.status} />
            </Link>
          </section>

          <section className="sheet p-4" aria-labelledby="where-heading">
            <h2 id="where-heading" className="eyebrow">
              Where
            </h2>
            {loc ? (
              <div className="mt-3 space-y-2 text-sm">
                {loc.text && <p className="leading-relaxed">{loc.text}</p>}
                {hasCoords && (
                  <a href={osmLink(loc)} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1.5 text-ink">
                    <MapPin className="size-4" aria-hidden="true" />
                    Open map ({loc.precision === "exact" ? "exact" : "approx. ~100 m"})
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-3">No location shared. Ask in the chat.</p>
            )}
          </section>

          {report.hasPhoto && (
            <section className="sheet p-4" aria-labelledby="photo-heading">
              <h2 id="photo-heading" className="eyebrow">
                Photo
              </h2>
              <div className="mt-3">
                <ReportPhoto reportId={report.id} />
              </div>
            </section>
          )}

          <section className="sheet p-4" aria-labelledby="actions-heading">
            <h2 id="actions-heading" className="eyebrow mb-3">
              Actions
            </h2>
            <Actions report={report} onAction={act} />
          </section>
        </aside>
      </div>
    </div>
  );
}
