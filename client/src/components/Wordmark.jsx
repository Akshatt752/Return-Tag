import { Link } from "react-router-dom";
import { Tag } from "lucide-react";

export default function Wordmark({ className = "", to = "/" }) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 font-display font-semibold tracking-tight text-ink ${className}`}
    >
      <span className="grid size-7 place-items-center rounded-md bg-ink">
        <Tag className="size-4 fill-tag text-tag" aria-hidden="true" strokeWidth={2.25} />
      </span>
      ReturnTag
    </Link>
  );
}
