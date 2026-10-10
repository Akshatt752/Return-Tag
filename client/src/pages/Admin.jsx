import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Printer, TriangleAlert } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import { useAuth } from "../context/auth";
import { downloadText } from "../utils/download";
import { compact, formatCode, formatDate, hours, percent } from "../utils/format";
import StatTile from "../components/StatTile";
import { ErrorNote, OkNote } from "../components/ErrorNote";
import Spinner, { PageSpinner } from "../components/Spinner";
import NotFound from "./NotFound";

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function CreateBatch({ onCreated }) {
  const [form, setForm] = useState({ name: "", organization: "", count: 50 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/admin/batches", {
        name: form.name.trim(),
        organization: form.organization.trim(),
        count: Number(form.count),
      });
      setResult(data);
      onCreated();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const downloadCsv = () => {
    const rows = [["code", "claimCode", "url"], ...result.tags.map((t) => [t.code, t.claimCode, t.url])];
    const slug = (result.batch?.name || "batch").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    downloadText(rows.map((r) => r.map(csvCell).join(",")).join("\n"), `returntag-${slug}.csv`, "text/csv");
  };

  return (
    <section className="sheet p-5 sm:p-6" aria-labelledby="batch-heading">
      <h2 id="batch-heading" className="heading text-xl">
        Create a tag batch
      </h2>
      <p className="mt-1 text-sm text-ink-2">Pre-printed tags for schools, businesses and partner brands. Buyers claim them with a private code.</p>

      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-end">
        <div>
          <label htmlFor="batch-name" className="label">
            Batch name
          </label>
          <input id="batch-name" className="input" value={form.name} onChange={set("name")} placeholder="Fall 2026 freshers" required maxLength={80} />
        </div>
        <div>
          <label htmlFor="batch-org" className="label">
            Organization
          </label>
          <input id="batch-org" className="input" value={form.organization} onChange={set("organization")} placeholder="Optional" maxLength={80} />
        </div>
        <div>
          <label htmlFor="batch-count" className="label">
            Tags
          </label>
          <input id="batch-count" type="number" min={1} max={500} className="input" value={form.count} onChange={set("count")} required />
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Spinner className="size-4" /> : "Generate"}
        </button>
      </form>
      <ErrorNote className="mt-4">{error}</ErrorNote>

      {result && (
        <div className="mt-6 space-y-4">
          <p className="flex gap-2 rounded-md border border-lost/40 bg-lost/10 px-4 py-3 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-lost" aria-hidden="true" />
            <span>
              <strong className="font-semibold">Download the CSV now.</strong> Claim codes are shown only once and can't be
              recovered. Each claim code goes inside the pack with its tag.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-accent btn-sm" onClick={downloadCsv}>
              <Download className="size-3.5" aria-hidden="true" />
              Download CSV ({result.tags.length})
            </button>
            {result.batch?.id && (
              <Link to={`/admin/batches/${result.batch.id}/print`} className="btn-secondary btn-sm">
                <Printer className="size-3.5" aria-hidden="true" />
                Print QR labels
              </Link>
            )}
          </div>
          <div className="max-h-72 overflow-auto rounded-md border border-line">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-muted text-ink-3">
                <tr>
                  <th className="px-3 py-2 font-medium">Tag code</th>
                  <th className="px-3 py-2 font-medium">Claim code</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {result.tags.map((t) => (
                  <tr key={t.code} className="border-t border-line">
                    <td className="px-3 py-1.5">{formatCode(t.code)}</td>
                    <td className="px-3 py-1.5">{t.claimCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function SetPlan() {
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("premium");
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setOk("");
    setError("");
    setBusy(true);
    try {
      const { data } = await api.patch("/admin/users/plan", { email: email.trim(), plan });
      setOk(`${data.user.email} is now on the ${data.user.plan} plan.`);
      setEmail("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sheet p-5 sm:p-6" aria-labelledby="plan-heading">
      <h2 id="plan-heading" className="heading text-xl">
        Set a user's plan
      </h2>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
        <div>
          <label htmlFor="plan-email" className="label">
            Email
          </label>
          <input id="plan-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="plan-select" className="label">
            Plan
          </label>
          <select id="plan-select" className="input" value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
        </div>
        <button type="submit" className="btn-secondary" disabled={busy}>
          {busy ? <Spinner className="size-4" /> : "Update"}
        </button>
      </form>
      <OkNote className="mt-3">{ok}</OkNote>
      <ErrorNote className="mt-3">{error}</ErrorNote>
    </section>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [stats, setStats] = useState(null);
  const [batches, setBatches] = useState([]);
  const [spam, setSpam] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, b, r] = await Promise.all([
        api.get("/admin/stats"),
        api.get("/admin/batches"),
        api.get("/admin/reports?status=spam"),
      ]);
      setStats(s.data);
      setBatches(b.data.batches);
      setSpam(r.data.reports);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  if (!isAdmin) return <NotFound />;
  if (!stats) {
    return error ? (
      <div className="container-page py-12">
        <ErrorNote>{error}</ErrorNote>
      </div>
    ) : (
      <PageSpinner />
    );
  }

  return (
    <div className="container-page space-y-6 py-10 sm:py-12">
      <div>
        <p className="eyebrow">Admin</p>
        <h1 className="heading mt-2 text-3xl sm:text-4xl">Network overview</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Users" value={compact(stats.users)} note={`${stats.premiumUsers} premium`} />
        <StatTile
          label="Tags"
          value={compact(stats.tags.total)}
          note={`${stats.tags.unclaimed} unclaimed · ${stats.tags.lost + stats.tags.found} missing`}
        />
        <StatTile label="Finder reports" value={compact(stats.reports.total)} note={`${stats.reports.open} open · ${stats.reports.spam} spam`} />
        <StatTile
          label="Recovery rate"
          value={percent(stats.recoveryRate)}
          note={`${stats.incidents.recovered} recovered · avg ${hours(stats.avgRecoveryHours)}`}
        />
      </div>

      <CreateBatch onCreated={load} />

      <section className="sheet p-5 sm:p-6" aria-labelledby="batches-heading">
        <h2 id="batches-heading" className="heading text-xl">
          Batches
        </h2>
        {batches.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">No batches yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs text-ink-3">
                <tr>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Organization</th>
                  <th className="py-2 pr-8 text-right font-medium">Claimed</th>
                  <th className="py-2 font-medium">Created</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t border-line">
                    <td className="py-2.5 pr-4 font-medium">{b.name}</td>
                    <td className="py-2.5 pr-4 text-ink-2">{b.organization || "—"}</td>
                    <td className="py-2.5 pr-8 text-right tabular-nums">
                      {b.claimed}/{b.count}
                    </td>
                    <td className="py-2.5 text-ink-3">{formatDate(b.createdAt)}</td>
                    <td className="py-2.5 text-right">
                      <Link to={`/admin/batches/${b.id}/print`} className="btn-secondary btn-sm">
                        <Printer className="size-3.5" aria-hidden="true" />
                        Print
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="sheet p-5 sm:p-6" aria-labelledby="spam-heading">
        <h2 id="spam-heading" className="heading text-xl">
          Reports marked as spam
        </h2>
        {spam.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">Nothing flagged.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-ink-3">
                <tr>
                  <th className="py-2 font-medium">Tag</th>
                  <th className="py-2 font-medium">Message</th>
                  <th className="py-2 font-medium">Owner</th>
                  <th className="py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {spam.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="py-2.5 font-mono text-xs">{formatCode(r.tagCode)}</td>
                    <td className="max-w-xs py-2.5 break-words text-ink-2">{r.excerpt}</td>
                    <td className="py-2.5 text-ink-2">{r.ownerEmail}</td>
                    <td className="py-2.5 whitespace-nowrap text-ink-3">{formatDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SetPlan />
    </div>
  );
}
