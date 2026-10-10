import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Bookmark, CircleCheck, LockKeyhole } from "lucide-react";
import api, { finderHeaders, getErrorMessage } from "../api/client";
import { findFinderToken, forgetFinderReport, saveFinderReport } from "../utils/finderReports";
import { formatCode, formatDate } from "../utils/format";
import ChatThread from "../components/ChatThread";
import CategoryIcon from "../components/CategoryIcon";
import { ErrorNote } from "../components/ErrorNote";
import { PageSpinner } from "../components/Spinner";
import usePolling from "../hooks/usePolling";

function readToken(hash, reportId) {
  const fromHash = decodeURIComponent((hash || "").replace(/^#/, "")).trim();
  return fromHash || findFinderToken(reportId);
}

export default function FinderChat() {
  const { id } = useParams();
  const { hash } = useLocation();
  const [token] = useState(() => readToken(hash, id));

  const [report, setReport] = useState(null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(!token);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get(`/public/reports/${id}`, finderHeaders(token));
      setReport(data.report);
      setMessages(data.messages);
      setError("");
      // Remember this conversation on the device, so /found can link back to it
      saveFinderReport({
        reportId: data.report.id,
        token,
        label: data.report.tag?.publicLabel,
        code: data.report.tag?.code,
        createdAt: data.report.createdAt,
      });
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403 || status === 404) {
        setDenied(true);
        forgetFinderReport(id);
      } else {
        setError(getErrorMessage(err));
      }
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  // Opened from this device's saved list without the #token: put it back so a bookmark works
  useEffect(() => {
    if (token && !hash) window.history.replaceState(window.history.state, "", `#${token}`);
  }, [token, hash]);

  usePolling(load, 10000, Boolean(report) && !denied);

  const send = async (body) => {
    const { data } = await api.post(`/public/reports/${id}/messages`, { body }, finderHeaders(token));
    setMessages((list) => [...list, data.message]);
  };

  if (denied) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <LockKeyhole className="mx-auto size-8 text-ink-3" aria-hidden="true" />
        <h1 className="heading mt-4 text-3xl">This private link doesn't work</h1>
        <p className="mt-3 leading-relaxed text-ink-2">
          Conversations can only be opened with the full link you got after sending your report, including the part
          after the <span className="code">#</span>. If you gave your email, the link is in the confirmation we sent.
        </p>
        <Link to="/found" className="btn-secondary mt-8">
          See reports saved on this device
        </Link>
      </div>
    );
  }

  if (!report) {
    return error ? (
      <div className="mx-auto max-w-xl px-4 py-20">
        <ErrorNote>{error}</ErrorNote>
      </div>
    ) : (
      <PageSpinner />
    );
  }

  const closed = report.status !== "open";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-8 pb-16 sm:pt-12">
      <div className="flex items-center gap-3">
        <CategoryIcon category={report.tag?.category} />
        <div className="min-w-0">
          <p className="eyebrow">Your report · {formatCode(report.tag?.code)}</p>
          <h1 className="heading truncate text-2xl sm:text-3xl">{report.tag?.publicLabel}</h1>
        </div>
      </div>

      {report.status === "resolved" ? (
        <p className="alert-ok mt-6 flex gap-2">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-returned" aria-hidden="true" />
          The owner has closed this conversation. Thank you for helping. You made someone's day.
        </p>
      ) : (
        <div className="mt-6 flex gap-3 rounded-md border border-tag/60 bg-tag/10 px-4 py-3 text-sm leading-relaxed text-ink">
          <Bookmark className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            <strong className="font-semibold">Bookmark this page. It's your private link.</strong> Anyone with it can read
            this conversation, so don't share it. The owner has been notified and will reply here.
          </p>
        </div>
      )}

      <div className="mt-6">
        <ErrorNote className="mb-3">{error}</ErrorNote>
        <ChatThread
          messages={messages}
          me="finder"
          otherName="Owner"
          onSend={send}
          closedNote={closed ? "This conversation is closed." : null}
          placeholder="Reply to the owner…"
        />
      </div>

      <p className="mt-4 text-xs text-ink-3">
        Sent as “{report.alias || "Finder"}” on {formatDate(report.createdAt, true)}. The owner can't see your email or
        any contact details.
      </p>
    </div>
  );
}
