import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, MessageSquare, ScanLine } from "lucide-react";
import { listFinderReports } from "../utils/finderReports";
import { formatCode, normalizeCode, timeAgo } from "../utils/format";
import { ErrorNote } from "../components/ErrorNote";

export default function FindCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [reports] = useState(listFinderReports);

  const submit = (e) => {
    e.preventDefault();
    const clean = normalizeCode(code);
    if (clean.length !== 10) {
      setError("Tag codes are 10 letters and numbers, like K7XQ2-M9PRA.");
      return;
    }
    navigate(`/t/${clean}`);
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-14 sm:py-20">
      <span className="grid size-12 place-items-center rounded-lg bg-tag text-[#191917]">
        <ScanLine className="size-6" aria-hidden="true" />
      </span>
      <h1 className="heading mt-5 text-4xl">Found something?</h1>
      <p className="mt-3 leading-relaxed text-ink-2">
        Scanning the QR code with your phone camera is quickest. If it's damaged, type the code printed under it.
        You'll be able to message the owner without sharing your contact details.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-3">
        <ErrorNote>{error}</ErrorNote>
        <label htmlFor="code" className="label">
          Tag code
        </label>
        <div className="flex gap-2">
          <input
            id="code"
            className="input code text-lg uppercase sm:text-lg"
            placeholder="K7XQ2-M9PRA"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError("");
            }}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={16}
            required
          />
          <button type="submit" className="btn-primary shrink-0">
            Look up
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </form>

      {reports.length > 0 && (
        <section className="mt-14" aria-labelledby="sent-heading">
          <h2 id="sent-heading" className="eyebrow">
            Reports you've sent from this device
          </h2>
          <ul className="mt-4 space-y-2">
            {reports.map((r) => (
              <li key={r.reportId}>
                <Link
                  to={`/r/${r.reportId}#${r.token}`}
                  className="sheet flex items-center gap-3 p-3.5 transition hover:border-line-strong"
                >
                  <MessageSquare className="size-4 text-ink-3" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.label || "Item"}</span>
                    <span className="block text-xs text-ink-3">
                      {r.code ? `${formatCode(r.code)} · ` : ""}
                      {timeAgo(r.createdAt)}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-ink-3" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
