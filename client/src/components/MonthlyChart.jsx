import { useState } from "react";
import { monthLabel } from "../utils/format";

// Grouped columns: items that went missing vs items recovered, per month.
// Colours are validated categorical slots (see --series-* in index.css).
const SERIES = [
  { key: "lost", label: "Went missing", color: "bg-series-2" },
  { key: "recovered", label: "Recovered", color: "bg-series-1" },
];

function niceTicks(max) {
  if (max <= 4) return Array.from({ length: Math.max(max, 1) + 1 }, (_, i) => i);
  const step = Math.ceil(max / 4);
  return Array.from({ length: 5 }, (_, i) => i * step);
}

export default function MonthlyChart({ data = [] }) {
  const [active, setActive] = useState(null); // { i, key }
  const max = Math.max(0, ...data.flatMap((d) => SERIES.map((s) => d[s.key] || 0)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const empty = max === 0;

  return (
    <figure className="sheet p-4 sm:p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <span>
          <span className="block text-sm font-medium text-ink">Lost vs recovered</span>
          <span className="block text-xs text-ink-3">Last 6 months</span>
        </span>
        <ul className="flex items-center gap-4 text-xs text-ink-2" aria-label="Legend">
          {SERIES.map((s) => (
            <li key={s.key} className="inline-flex items-center gap-1.5">
              <span className={`size-2.5 rounded-[3px] ${s.color}`} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      </figcaption>

      {empty ? (
        <p className="mt-6 rounded-md bg-muted/60 px-4 py-8 text-center text-sm text-ink-2">
          Nothing went missing in the last six months.
        </p>
      ) : (
        <div className="mt-5 flex gap-2">
          {/* Y axis */}
          <div className="relative h-40 w-5 shrink-0 font-mono text-[10px] text-ink-3 tabular-nums" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
                {t}
              </span>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            {/* Gridlines: hairline, solid, recessive */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40" aria-hidden="true">
              {ticks.map((t) => (
                <span
                  key={t}
                  className={`absolute inset-x-0 h-px ${t === 0 ? "bg-line-strong" : "bg-line"}`}
                  style={{ bottom: `${(t / top) * 100}%` }}
                />
              ))}
            </div>

            <div className="relative flex h-40 items-end justify-around">
              {data.map((d, i) => (
                <div key={d.month} className="flex h-full items-end gap-[2px]">
                  {SERIES.map((s) => {
                    const value = d[s.key] || 0;
                    const isActive = active?.i === i && active?.key === s.key;
                    return (
                      // The whole column height is the hit target, not just the painted bar
                      <div
                        key={s.key}
                        tabIndex={0}
                        role="img"
                        aria-label={`${monthLabel(d.month)}: ${value} ${s.label.toLowerCase()}`}
                        className="relative flex h-full w-3 cursor-default items-end outline-none sm:w-5"
                        onPointerEnter={() => setActive({ i, key: s.key })}
                        onPointerLeave={() => setActive(null)}
                        onFocus={() => setActive({ i, key: s.key })}
                        onBlur={() => setActive(null)}
                      >
                        <span
                          className={`block w-full rounded-t-[4px] transition-opacity ${s.color} ${
                            active && !isActive ? "opacity-60" : ""
                          }`}
                          style={{ height: value ? `${(value / top) * 100}%` : 0 }}
                        />
                        {isActive && (
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md border border-line bg-card px-2.5 py-1.5 whitespace-nowrap shadow-sm">
                            <span className="block text-sm font-semibold text-ink">{value}</span>
                            <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
                              <span className={`h-0.5 w-3 rounded-full ${s.color}`} aria-hidden="true" />
                              {s.label} · {monthLabel(d.month)}
                            </span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="mt-2 flex justify-around font-mono text-[10px] text-ink-3" aria-hidden="true">
              {data.map((d) => (
                <span key={d.month}>{monthLabel(d.month)}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-xs text-ink-3 hover:text-ink">View as table</summary>
        <table className="mt-3 w-full text-left text-xs">
          <thead className="text-ink-3">
            <tr>
              <th className="py-1 font-medium">Month</th>
              {SERIES.map((s) => (
                <th key={s.key} className="py-1 text-right font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {data.map((d) => (
              <tr key={d.month} className="border-t border-line">
                <td className="py-1.5 text-ink-2">{monthLabel(d.month)}</td>
                {SERIES.map((s) => (
                  <td key={s.key} className="py-1.5 text-right text-ink">
                    {d[s.key] || 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
