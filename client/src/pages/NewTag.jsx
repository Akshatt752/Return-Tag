import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/auth";
import TagForm from "../components/TagForm";

export default function NewTag() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (user?.tagLimit === null || user?.tagLimit === undefined) return;
    api
      .get("/stats/me")
      .then(({ data }) => setCount(data.tags.total))
      .catch(() => {});
  }, [user?.tagLimit]);

  const create = async (payload) => {
    const { data } = await api.post("/tags", payload);
    navigate(`/tags/${data.tag.id}`, { replace: true, state: { created: true } });
  };

  const atLimit = user?.tagLimit !== null && count !== null && count >= user?.tagLimit;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Dashboard
      </Link>
      <h1 className="heading mt-5 text-4xl">New tag</h1>
      <p className="mt-3 leading-relaxed text-ink-2">
        You'll get a QR code to print or download. Anyone who scans it can message you, but they'll never see your name,
        email or phone.
      </p>
      {user?.tagLimit !== null && count !== null && (
        <p className={`mt-4 text-sm ${atLimit ? "alert-error" : "text-ink-3"}`}>
          {atLimit
            ? `You've used all ${user.tagLimit} tags on the free plan. Disable or relink an existing tag, or upgrade to premium.`
            : `${count} of ${user.tagLimit} tags used (free plan).`}
        </p>
      )}
      <div className="mt-10">
        <TagForm submitLabel="Create tag" onSubmit={create} idPrefix="new" />
      </div>
    </div>
  );
}
