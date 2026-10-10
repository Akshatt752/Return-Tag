import { useState } from "react";
import { Eye, Gift, Lock } from "lucide-react";
import { getErrorMessage } from "../api/client";
import { CATEGORIES } from "../utils/categories";
import { EMPTY_TAG } from "../utils/tagForm";
import CategoryIcon from "./CategoryIcon";
import { ErrorNote } from "./ErrorNote";
import Spinner from "./Spinner";

// Used to create a tag, edit it, and relink it to a new item.
// Splits fields into what only the owner sees vs what a finder sees.
export default function TagForm({ initial = EMPTY_TAG, submitLabel = "Save", onSubmit, idPrefix = "tag", extra }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const setItem = (field) => (e) => setForm((f) => ({ ...f, item: { ...f.item, [field]: e.target.value } }));
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const id = (name) => `${idPrefix}-${name}`;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit({
        item: {
          name: form.item.name.trim(),
          category: form.item.category,
          description: form.item.description.trim(),
        },
        publicLabel: form.publicLabel.trim(),
        publicMessage: form.publicMessage.trim(),
        rewardOffered: form.rewardOffered,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      <fieldset className="space-y-5">
        <legend className="flex items-center gap-2 text-sm font-semibold">
          <Lock className="size-4 text-ink-3" aria-hidden="true" />
          Private: only you see this
        </legend>
        <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
          <div>
            <label htmlFor={id("name")} className="label">
              Item name
            </label>
            <input
              id={id("name")}
              className="input"
              value={form.item.name}
              onChange={setItem("name")}
              placeholder="e.g. MacBook Pro 14 (work)"
              maxLength={80}
              required
            />
          </div>
          <div>
            <label htmlFor={id("category")} className="label">
              Category
            </label>
            <select id={id("category")} className="input" value={form.item.category} onChange={setItem("category")}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label htmlFor={id("description")} className="label">
            Private notes
          </label>
          <textarea
            id={id("description")}
            className="input min-h-20"
            rows={2}
            value={form.item.description}
            onChange={setItem("description")}
            placeholder="Serial number, distinguishing marks, what's inside…"
            maxLength={500}
          />
          <p className="hint">Useful for checking a finder's description matches. Never shown to finders.</p>
        </div>
      </fieldset>

      <fieldset className="space-y-5 border-t border-line pt-8">
        <legend className="flex items-center gap-2 text-sm font-semibold">
          <Eye className="size-4 text-accent" aria-hidden="true" />
          Public: what a finder sees after scanning
        </legend>
        <div>
          <label htmlFor={id("label")} className="label">
            Public label
          </label>
          <input
            id={id("label")}
            className="input"
            value={form.publicLabel}
            onChange={set("publicLabel")}
            placeholder="e.g. Black backpack"
            maxLength={60}
            required
          />
          <p className="hint">Describe the item, not yourself. Don't include your name or phone number.</p>
        </div>
        <div>
          <label htmlFor={id("message")} className="label">
            Message to the finder
          </label>
          <textarea
            id={id("message")}
            className="input min-h-20"
            rows={3}
            value={form.publicMessage}
            onChange={set("publicMessage")}
            placeholder="Thank you for scanning! Any reception desk is fine, or message me to meet up."
            maxLength={280}
          />
          <p className="hint flex justify-between">
            <span>Optional.</span>
            <span className="font-mono">{form.publicMessage.length}/280</span>
          </p>
        </div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-[var(--accent)]"
            checked={form.rewardOffered}
            onChange={(e) => setForm((f) => ({ ...f, rewardOffered: e.target.checked }))}
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Gift className="size-4" aria-hidden="true" />
              Offer a reward
            </span>
            <span className="mt-0.5 block text-xs text-ink-3">Shows a "reward offered" badge. You arrange the details in chat.</span>
          </span>
        </label>

        {/* Live preview of the finder's view */}
        <div aria-hidden="true">
          <p className="eyebrow mb-2">Finder preview</p>
          <div className="tag-shape relative max-w-sm bg-tag p-4 pl-7 text-[#191917]">
            <span className="absolute top-1/2 left-2.5 size-2.5 -translate-y-1/2 rounded-full bg-paper" />
            <div className="flex items-center gap-3">
              <CategoryIcon category={form.item.category} boxClassName="size-9 bg-black/10 text-[#191917]" className="size-4" />
              <p className="min-w-0 truncate font-display text-lg font-semibold">{form.publicLabel || "Black backpack"}</p>
            </div>
            {form.rewardOffered && (
              <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-[#191917] px-2.5 py-0.5 text-[11px] text-tag">
                <Gift className="size-3" /> Reward offered
              </p>
            )}
          </div>
        </div>
      </fieldset>

      {extra}

      <ErrorNote>{error}</ErrorNote>

      <button type="submit" className="btn-primary w-full py-3 sm:w-auto" disabled={saving}>
        {saving ? <Spinner className="size-4" /> : submitLabel}
      </button>
    </form>
  );
}
