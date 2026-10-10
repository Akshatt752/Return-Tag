import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeftRight } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import { useAuth } from "../context/auth";
import { formatCode, formatDate } from "../utils/format";
import CategoryIcon from "../components/CategoryIcon";
import { ErrorNote } from "../components/ErrorNote";
import Spinner, { PageSpinner } from "../components/Spinner";

export default function Transfer() {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [token] = useState(() => decodeURIComponent(hash.replace(/^#/, "")).trim());
  const [transfer, setTransfer] = useState(null);
  const [error, setError] = useState(token ? "" : "This transfer link is incomplete. Ask the owner to send it again.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      // POST with the token in the body, so it never shows up in a URL path or access log
      .post("/tags/transfer/preview", { token })
      .then(({ data }) => setTransfer(data.transfer))
      .catch((err) => setError(getErrorMessage(err)));
  }, [token]);

  const accept = async () => {
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/tags/transfer/accept", { token });
      navigate(`/tags/${data.tag.id}`, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  if (!transfer && !error) return <PageSpinner />;

  const wrongAccount = transfer && user && transfer.toEmail?.toLowerCase() !== user.email?.toLowerCase();

  return (
    <div className="mx-auto w-full max-w-md px-4 py-14 sm:py-20">
      <span className="grid size-12 place-items-center rounded-lg bg-muted">
        <ArrowLeftRight className="size-6" aria-hidden="true" />
      </span>
      <h1 className="heading mt-5 text-4xl">Accept a tag</h1>

      <ErrorNote className="mt-6">{error}</ErrorNote>

      {transfer && (
        <>
          <p className="mt-3 leading-relaxed text-ink-2">
            Someone is handing this tag over to you. Once you accept, it's yours: finders who scan it will reach you. You
            won't see any of the previous owner's conversations.
          </p>
          <div className="sheet mt-6 flex items-center gap-3 p-4">
            <CategoryIcon category={transfer.category} />
            <div className="min-w-0">
              <p className="truncate font-medium">{transfer.publicLabel || "Tag"}</p>
              <p className="code text-xs text-ink-3">{formatCode(transfer.code)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-3">
            For {transfer.toEmail} · expires {formatDate(transfer.expiresAt)}
          </p>
          {wrongAccount && (
            <p className="alert-error mt-4">
              You're logged in as {user.email}. Log in with {transfer.toEmail} to accept this tag.
            </p>
          )}
          <button type="button" className="btn-primary mt-6 w-full py-3" onClick={accept} disabled={busy || wrongAccount}>
            {busy ? <Spinner className="size-4" /> : "Accept tag"}
          </button>
        </>
      )}
    </div>
  );
}
