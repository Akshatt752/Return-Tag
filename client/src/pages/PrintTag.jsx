import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import StickerSheet from "../components/StickerSheet";
import { ErrorNote } from "../components/ErrorNote";
import { PageSpinner } from "../components/Spinner";

const COPIES = 8;

export default function PrintTag() {
  const { id } = useParams();
  const [tag, setTag] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/tags/${id}`)
      .then(({ data }) => setTag(data.tag))
      .catch((err) => setError(getErrorMessage(err)));
  }, [id]);

  if (error) {
    return (
      <div className="container-page py-12">
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }
  if (!tag) return <PageSpinner />;

  return (
    <>
      <div className="no-print container-page pt-8">
        <Link to={`/tags/${tag.id}`} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to {tag.publicLabel || "tag"}
        </Link>
      </div>
      <StickerSheet
        title="Print stickers"
        note={`${COPIES} identical labels for “${tag.publicLabel || "this tag"}”. Stick one on the item and keep spares for its case, charger or keyring. Print on sticker paper, or on plain paper and laminate.`}
        items={Array.from({ length: COPIES }, () => ({ code: tag.code, url: tag.url }))}
      />
    </>
  );
}
