import { Loader2 } from "lucide-react";

export default function Spinner({ className = "size-5", label }) {
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />
      {label && <span className="text-sm">{label}</span>}
    </span>
  );
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-ink-3">
      <Spinner className="size-6" />
    </div>
  );
}
