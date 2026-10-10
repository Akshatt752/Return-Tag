import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../context/theme";

// Quick light/dark switch for the navbar
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      onClick={toggle}
      className="grid size-9 place-items-center rounded-md text-ink-2 transition hover:bg-muted hover:text-ink"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}

const OPTIONS = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

// Three-way picker for the footer, including "follow my device"
export function ThemeSwitch() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="inline-flex w-fit rounded-md border border-line p-0.5" role="radiogroup" aria-label="Colour theme">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={preference === value}
          onClick={() => setPreference(value)}
          className={`inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-xs transition ${
            preference === value ? "bg-muted text-ink" : "text-ink-3 hover:text-ink"
          }`}
        >
          <Icon className="size-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
