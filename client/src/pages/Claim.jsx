import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, PackageOpen } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import { formatCode, normalizeCode } from "../utils/format";
import { ErrorNote } from "../components/ErrorNote";
import Spinner from "../components/Spinner";

export default function Claim() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [code, setCode] = useState(() => formatCode(params.get("code") || ""));
  const [claimCode, setClaimCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/tags/claim", { code: normalizeCode(code), claimCode: normalizeCode(claimCode) });
      navigate(`/tags/${data.tag.id}`, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Dashboard
      </Link>
      <span className="mt-6 grid size-12 place-items-center rounded-lg bg-tag text-[#191917]">
        <PackageOpen className="size-6" aria-hidden="true" />
      </span>
      <h1 className="heading mt-5 text-4xl">Claim a pre-printed tag</h1>
      <p className="mt-3 leading-relaxed text-ink-2">
        Tags from schools, offices and partner brands come with a private claim code inside the pack. Enter both codes
        to link the tag to your account.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <ErrorNote>{error}</ErrorNote>
        <div>
          <label htmlFor="claim-tag-code" className="label">
            Tag code
          </label>
          <input
            id="claim-tag-code"
            className="input code uppercase"
            placeholder="K7XQ2-M9PRA"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={16}
            required
          />
          <p className="hint">Printed under the QR code.</p>
        </div>
        <div>
          <label htmlFor="claim-secret" className="label">
            Claim code
          </label>
          <input
            id="claim-secret"
            className="input code uppercase"
            placeholder="8 characters"
            value={claimCode}
            onChange={(e) => setClaimCode(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={16}
            required
          />
          <p className="hint">On the card inside the pack. Keep it private: whoever has it can claim the tag.</p>
        </div>
        <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
          {busy ? <Spinner className="size-4" /> : "Claim tag"}
        </button>
      </form>
    </div>
  );
}
