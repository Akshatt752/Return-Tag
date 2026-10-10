import { Link } from "react-router-dom";
import { MessageSquare, ScanLine } from "lucide-react";
import { formatCode } from "../utils/format";
import CategoryIcon from "./CategoryIcon";
import StatusPill from "./StatusPill";

export default function TagCard({ tag }) {
  return (
    <Link
      to={`/tags/${tag.id}`}
      className="sheet group flex flex-col gap-4 p-4 transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="flex items-start gap-3">
        <CategoryIcon category={tag.item?.category} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{tag.publicLabel || "Untitled tag"}</p>
          <p className="truncate text-sm text-ink-3">{tag.item?.name || "No item details yet"}</p>
        </div>
        <StatusPill status={tag.status} />
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-xs text-ink-3">
        <span className="code text-ink-2">{formatCode(tag.code)}</span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1" title="Scans">
            <ScanLine className="size-3.5" aria-hidden="true" />
            {tag.scanCount ?? 0}
            <span className="sr-only">scans</span>
          </span>
          {tag.openReports > 0 && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ${tag.unread > 0 ? "bg-accent font-semibold text-white dark:text-paper" : ""}`}
              title={tag.unread > 0 ? `${tag.unread} unread messages` : `${tag.openReports} open reports`}
            >
              <MessageSquare className="size-3.5" aria-hidden="true" />
              {tag.unread > 0 ? tag.unread : tag.openReports}
              <span className="sr-only">{tag.unread > 0 ? "unread messages" : "open reports"}</span>
            </span>
          )}
        </span>
      </div>
    </Link>
  );
}
