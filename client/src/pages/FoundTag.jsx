import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ban, Camera, Gift, Info, LoaderCircle, LockKeyhole, MapPin, PackageOpen, TriangleAlert, X } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import { saveFinderReport } from "../utils/finderReports";
import { formatCode, normalizeCode } from "../utils/format";
import { getCategory } from "../utils/categories";
import CategoryIcon from "../components/CategoryIcon";
import { ErrorNote } from "../components/ErrorNote";
import Spinner, { PageSpinner } from "../components/Spinner";
import Turnstile from "../components/Turnstile";
import { TURNSTILE_SITE_KEY } from "../utils/config";
import NotFound from "./NotFound";

const MAX_PHOTO = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

function TagHeader({ tag }) {
  return (
    <div className="tag-shape relative bg-tag p-5 pl-8 text-[#191917]">
      <span className="absolute top-1/2 left-3 size-3 -translate-y-1/2 rounded-full bg-paper" aria-hidden="true" />
      <div className="flex items-start gap-3">
        <CategoryIcon category={tag.category} boxClassName="size-11 bg-black/10 text-[#191917]" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-semibold tracking-[0.16em] uppercase opacity-75">
            {getCategory(tag.category).label} · {formatCode(tag.code)}
          </p>
          <h1 className="mt-1 font-display text-2xl leading-tight font-semibold break-words sm:text-3xl">
            {tag.publicLabel}
          </h1>
        </div>
      </div>
      {tag.rewardOffered && (
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#191917] px-3 py-1 text-xs font-medium text-tag">
          <Gift className="size-3.5" aria-hidden="true" />
          The owner is offering a reward
        </p>
      )}
    </div>
  );
}

function StateNotice({ tag }) {
  if (tag.state === "lost") {
    return (
      <p className="flex gap-3 rounded-md border border-lost/40 bg-lost/10 px-4 py-3 text-sm text-ink" role="status">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-lost" aria-hidden="true" />
        <span>
          <strong className="font-semibold">The owner has reported this lost.</strong> They'll be notified the moment you
          send a message.
        </span>
      </p>
    );
  }
  if (tag.state === "found") {
    return (
      <p className="flex gap-3 rounded-md border border-found/40 bg-found/10 px-4 py-3 text-sm text-ink" role="status">
        <Info className="mt-0.5 size-4 shrink-0 text-found" aria-hidden="true" />
        <span>Someone has already reported finding this. You can still send the owner a message.</span>
      </p>
    );
  }
  return null;
}

function Unavailable({ tag }) {
  const unclaimed = tag.state === "unclaimed";
  const Icon = unclaimed ? PackageOpen : Ban;
  return (
    <div className="sheet p-6 text-center">
      <Icon className="mx-auto size-8 text-ink-3" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-semibold">
        {unclaimed ? "This tag hasn't been activated yet" : "This tag isn't active"}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        {unclaimed
          ? "If you just bought it, claim it to link it to your belongings."
          : "The owner has turned this tag off, so it can't receive messages. If you found the item, please hand it to a nearby lost & found desk."}
      </p>
      {unclaimed && (
        <Link to={`/claim?code=${tag.code}`} className="btn-primary mt-5">
          Claim this tag
        </Link>
      )}
    </div>
  );
}

export default function FoundTag() {
  const { code: rawCode } = useParams();
  const code = normalizeCode(rawCode);
  const navigate = useNavigate();

  const [tag, setTag] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const fetched = useRef(false);

  const startedAt = useRef(0);
  const [form, setForm] = useState({ message: "", locationText: "", alias: "", email: "", website: "" });
  const [shareLocation, setShareLocation] = useState(false);
  const [precision, setPrecision] = useState("approx");
  const [coords, setCoords] = useState(null);
  const [geoStatus, setGeoStatus] = useState(""); // "", "locating", "error message"
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const captcha = useRef(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch once: every load counts as a scan, so don't let StrictMode's double effect count twice
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    startedAt.current = Date.now();
    api
      .get(`/public/tags/${code}`)
      .then(({ data }) => setTag(data.tag))
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
        else setLoadError(getErrorMessage(err));
      });
  }, [code]);

  // Free the preview's object URL when it's replaced or the page closes
  useEffect(() => {
    if (!photoUrl) return;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const toggleLocation = (checked) => {
    setShareLocation(checked);
    if (!checked) {
      setCoords(null);
      setGeoStatus("");
      return;
    }
    if (!("geolocation" in navigator)) {
      setGeoStatus("Your browser can't share location. You can describe the place instead.");
      setShareLocation(false);
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("");
      },
      (err) => {
        setShareLocation(false);
        setGeoStatus(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. You can describe the place instead."
            : "Couldn't get your location. You can describe the place instead."
        );
      },
      { enableHighAccuracy: precision === "exact", timeout: 15000, maximumAge: 60000 }
    );
  };

  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      setError("Photos must be JPEG, PNG or WebP.");
      return;
    }
    if (file.size > MAX_PHOTO) {
      setError("That photo is over 5 MB. Please pick a smaller one.");
      return;
    }
    setError("");
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoUrl("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.message.trim().length < 5) {
      setError("Please write a short message for the owner (at least 5 characters).");
      return;
    }
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError("Please complete the check above the button.");
      return;
    }
    setError("");
    setSubmitting(true);

    const data = new FormData();
    data.append("message", form.message.trim());
    data.append("website", form.website);
    data.append("elapsedMs", String(Date.now() - startedAt.current));
    if (form.locationText.trim()) data.append("locationText", form.locationText.trim());
    if (form.alias.trim()) data.append("alias", form.alias.trim());
    if (form.email.trim()) data.append("email", form.email.trim());
    if (shareLocation && coords) {
      data.append("lat", String(coords.lat));
      data.append("lng", String(coords.lng));
      data.append("precision", precision);
    }
    if (photo) data.append("photo", photo);
    if (captchaToken) data.append("captchaToken", captchaToken);

    try {
      const { data: res } = await api.post(`/public/tags/${code}/reports`, data);
      saveFinderReport({
        reportId: res.reportId,
        token: res.token,
        label: tag.publicLabel,
        code: tag.code,
        createdAt: new Date().toISOString(),
      });
      navigate(`/r/${res.reportId}#${res.token}`, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
      captcha.current?.reset();
      setSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <NotFound
        title="No tag with that code."
        note="Check the code printed under the QR. Codes never contain 0, 1, O, I, L or U, so a character that looks like one of those is a similar letter or number."
      />
    );
  }
  if (loadError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20">
        <ErrorNote>{loadError}</ErrorNote>
        <button className="btn-secondary mt-4" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }
  if (!tag) return <PageSpinner />;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-8 pb-16 sm:pt-12">
      <p className="eyebrow mb-4">You found something</p>
      <TagHeader tag={tag} />

      {tag.publicMessage && (
        <blockquote className="mt-5 border-l-2 border-tag pl-4 text-ink-2">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{tag.publicMessage}</p>
          <footer className="mt-1 text-xs text-ink-3">The owner</footer>
        </blockquote>
      )}

      <div className="mt-5">
        <StateNotice tag={tag} />
      </div>

      {!tag.acceptingReports ? (
        <div className="mt-6">
          <Unavailable tag={tag} />
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-6" noValidate>
          <div>
            <h2 className="heading text-2xl">Let the owner know</h2>
            <p className="mt-2 flex gap-2 text-sm leading-relaxed text-ink-2">
              <LockKeyhole className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              The owner sees only what you write here. You'll get a private link to chat with them, and they'll never see
              your contact details.
            </p>
          </div>

          <div>
            <label htmlFor="message" className="label">
              Message for the owner <span className="text-lost">*</span>
            </label>
            <textarea
              id="message"
              className="input min-h-28"
              rows={4}
              maxLength={1000}
              value={form.message}
              onChange={update("message")}
              placeholder="Hi! I found your bag on the 8:15 bus. I can drop it at the station office, or meet nearby."
              required
            />
            <p className="hint flex justify-between">
              <span>Links are removed automatically.</span>
              <span className="font-mono">{form.message.length}/1000</span>
            </p>
          </div>

          <div>
            <label htmlFor="locationText" className="label">
              Where is it now, or where did you find it?
            </label>
            <input
              id="locationText"
              className="input"
              maxLength={140}
              value={form.locationText}
              onChange={update("locationText")}
              placeholder="e.g. Left it at the front desk of the library"
            />
          </div>

          <fieldset className="sheet space-y-3 p-4">
            <legend className="sr-only">Location</legend>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-[var(--accent)]"
                checked={shareLocation}
                onChange={(e) => toggleLocation(e.target.checked)}
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <MapPin className="size-4" aria-hidden="true" />
                  Share my location
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">
                  Only this item's owner sees it, and it's deleted 30 days after the item is returned.
                </span>
              </span>
            </label>
            {geoStatus === "locating" && (
              <p className="flex items-center gap-2 pl-7 text-xs text-ink-2" role="status">
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                Getting your location…
              </p>
            )}
            {geoStatus && geoStatus !== "locating" && (
              <p className="pl-7 text-xs text-lost" role="alert">
                {geoStatus}
              </p>
            )}
            {shareLocation && coords && (
              <div className="flex flex-wrap gap-x-5 gap-y-2 pl-7 text-sm" role="radiogroup" aria-label="Location precision">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="precision"
                    value="approx"
                    className="accent-[var(--accent)]"
                    checked={precision === "approx"}
                    onChange={() => setPrecision("approx")}
                  />
                  Approximate (~100 m)
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="precision"
                    value="exact"
                    className="accent-[var(--accent)]"
                    checked={precision === "exact"}
                    onChange={() => setPrecision("exact")}
                  />
                  Exact
                </label>
              </div>
            )}
          </fieldset>

          <div>
            <span className="label">Photo of the item (optional)</span>
            {photoUrl ? (
              <div className="relative inline-block">
                <img src={photoUrl} alt="Selected item" className="max-h-56 rounded-md border border-line object-cover" />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-ink/80 text-paper hover:bg-ink"
                  aria-label="Remove photo"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-line-strong px-4 py-5 text-sm text-ink-2 transition hover:bg-muted focus-within:outline-2 focus-within:outline-accent">
                <Camera className="size-4" aria-hidden="true" />
                Add a photo
                <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pickPhoto} />
              </label>
            )}
            <p className="hint">Hidden location data (EXIF/GPS) is stripped before the owner sees it. Max 5 MB.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="alias" className="label">
                Nickname (optional)
              </label>
              <input
                id="alias"
                className="input"
                maxLength={40}
                value={form.alias}
                onChange={update("alias")}
                placeholder="Shown instead of “Finder”"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="email" className="label">
                Your email (optional)
              </label>
              <input
                id="email"
                type="email"
                className="input"
                value={form.email}
                onChange={update("email")}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </div>
          <p className="-mt-3 text-xs leading-relaxed text-ink-3">
            Your email is only used to tell you when the owner replies. It's never shown to the owner.
          </p>

          {/* Honeypot: real people never see or fill this */}
          <div className="sr-only-field" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={update("website")} />
          </div>

          <Turnstile ref={captcha} onToken={setCaptchaToken} />

          <ErrorNote>{error}</ErrorNote>

          <button type="submit" className="btn-accent w-full py-3.5 text-base" disabled={submitting}>
            {submitting ? <Spinner className="size-5" label="Sending…" /> : "Send to the owner"}
          </button>
        </form>
      )}
    </div>
  );
}
