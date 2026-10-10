import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import { useAuth } from "../context/auth";
import StickerSheet from "../components/StickerSheet";
import { ErrorNote } from "../components/ErrorNote";
import { PageSpinner } from "../components/Spinner";
import NotFound from "./NotFound";

export default function PrintBatch() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get(`/admin/batches/${id}/tags`)
      .then(({ data }) => setData(data))
      .catch((err) => setError(getErrorMessage(err)));
  }, [id, isAdmin]);

  if (!isAdmin) return <NotFound />;
  if (error) {
    return (
      <div className="container-page py-12">
        <ErrorNote>{error}</ErrorNote>
      </div>
    );
  }
  if (!data) return <PageSpinner />;

  return (
    <>
      <div className="no-print container-page pt-8">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Admin
        </Link>
      </div>
      <StickerSheet
        title={`Batch: ${data.batch?.name || ""}`}
        note={`${data.tags.length} tags${data.batch?.organization ? ` for ${data.batch.organization}` : ""}. Claim codes aren't printed here. Pack each one with its tag from the CSV you downloaded when the batch was created.`}
        items={data.tags.map((t) => ({ code: t.code, url: t.url }))}
      />
    </>
  );
}
