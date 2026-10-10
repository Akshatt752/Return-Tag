// label (sentence case) · value (sans semibold, proportional figures) · optional note
export default function StatTile({ label, value, note, className = "" }) {
  return (
    <div className={`sheet p-4 ${className}`}>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-3">{note}</p>}
    </div>
  );
}
