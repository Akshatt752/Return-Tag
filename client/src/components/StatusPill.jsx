import { CircleCheck, CircleDot, MapPin, Ban, TriangleAlert, PackageOpen } from "lucide-react";

// Status always ships with an icon and a word, never colour alone
const STYLES = {
  active: { label: "Safe", icon: CircleDot, className: "border-line-strong text-ink-2" },
  lost: { label: "Lost", icon: TriangleAlert, className: "border-lost/40 bg-lost/10 text-lost" },
  found: { label: "Found", icon: MapPin, className: "border-found/40 bg-found/10 text-found" },
  returned: { label: "Returned", icon: CircleCheck, className: "border-returned/40 bg-returned/10 text-returned" },
  disabled: { label: "Disabled", icon: Ban, className: "border-line text-ink-3" },
  unclaimed: { label: "Unclaimed", icon: PackageOpen, className: "border-line text-ink-3" },
  // Report statuses
  open: { label: "Open", icon: CircleDot, className: "border-accent/40 bg-accent/10 text-accent" },
  resolved: { label: "Resolved", icon: CircleCheck, className: "border-line-strong text-ink-2" },
  spam: { label: "Spam", icon: Ban, className: "border-lost/40 text-lost" },
};

export default function StatusPill({ status, className = "" }) {
  const style = STYLES[status] || STYLES.active;
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${style.className} ${className}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {style.label}
    </span>
  );
}
