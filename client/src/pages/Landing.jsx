import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Camera,
  EyeOff,
  MapPin,
  MessagesSquare,
  QrCode,
  ScanLine,
  ShieldCheck,
  Tag,
} from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/auth";
import QRCode from "../components/QRCode";
import { compact, hours } from "../utils/format";

const STEPS = [
  {
    icon: Tag,
    title: "Tag it",
    body: "Create a tag for your bag, laptop or keys, then print the sticker or attach a pre-printed one.",
  },
  {
    icon: ScanLine,
    title: "Someone scans it",
    body: "The finder points their phone camera at the code. No app, no account, just a short form.",
  },
  {
    icon: MessagesSquare,
    title: "Chat and get it back",
    body: "You're notified at once and can arrange the return in an anonymous chat. Mark it returned when it's back.",
  },
];

const PRIVACY = [
  {
    icon: EyeOff,
    title: "No contact details, ever",
    body: "The tag shows a label you choose, like “Black backpack”. Your name, email and phone stay private.",
  },
  {
    icon: MessagesSquare,
    title: "Anonymous both ways",
    body: "You talk through a private thread. The finder's email, if they give one, is encrypted and never shown to you.",
  },
  {
    icon: MapPin,
    title: "Approximate location",
    body: "Finders can share where they are, rounded to about 100 m by default. It's deleted 30 days after the return.",
  },
  {
    icon: Camera,
    title: "Photos are cleaned",
    body: "Photos are re-encoded on the server, which strips the hidden EXIF and GPS data phones attach.",
  },
];

function Counter({ label, value }) {
  return (
    <div className="px-4 py-5 sm:px-6">
      <p className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-ink-3">{label}</p>
    </div>
  );
}

function HeroTag() {
  const scanUrl = `${window.location.origin}/found`;
  return (
    <div className="relative mx-auto w-full max-w-[300px] rotate-[-4deg] sm:max-w-[320px]">
      {/* String loop */}
      <div className="absolute -top-10 left-10 h-16 w-16 rounded-full border-[3px] border-ink-3/60" aria-hidden="true" />
      <div className="tag-shape relative bg-tag p-5 pl-8 text-[#191917] shadow-[0_20px_40px_-20px_rgb(0_0_0/0.35)]">
        <span className="absolute top-1/2 left-3 size-3 -translate-y-1/2 rounded-full bg-paper" aria-hidden="true" />
        <p className="font-mono text-[10px] font-semibold tracking-[0.18em] uppercase">Found me? Scan to return</p>
        <div className="mt-3 flex items-center gap-4">
          <QRCode url={scanUrl} className="size-28 shrink-0 p-1.5" label="Example tag QR code" />
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight font-semibold">Black backpack</p>
            <p className="mt-1 font-mono text-xs font-medium tracking-[0.08em]">K7XQ2-M9PRA</p>
            <p className="mt-3 text-[11px] leading-snug opacity-80">Owner contact stays private</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api
      .get("/stats/public")
      .then(({ data }) => setStats(data))
      .catch(() => setStats(null));
  }, []);

  const startLink = user ? "/tags/new" : "/register";

  return (
    <div>
      {/* Hero */}
      <section className="container-page grid items-center gap-14 pt-14 pb-16 sm:pt-20 lg:grid-cols-[1.2fr_1fr] lg:gap-10 lg:pb-24">
        <div>
          <p className="eyebrow">QR lost &amp; found network</p>
          <h1 className="heading mt-4 text-[40px] leading-[1.02] sm:text-6xl lg:text-[68px]">
            Lost it? Someone can return it, <span className="text-accent">without ever seeing your number.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
            Put a ReturnTag on your bag, laptop or keys. Whoever finds it scans the code and messages you through an
            anonymous chat. Neither of you shares contact details unless you choose to.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to={startLink} className="btn-primary py-3">
              Create your first tag
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link to="/found" className="btn-secondary py-3">
              <ScanLine className="size-4" aria-hidden="true" />
              Found something? Enter the code
            </Link>
          </div>
        </div>
        <div className="pt-8 lg:pt-0">
          <HeroTag />
        </div>
      </section>

      {/* Live counters */}
      <section className="container-page" aria-label="ReturnTag in numbers">
        {/* gap-px over a line-coloured background draws the dividers between cells */}
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4 [&>*]:bg-card">
          <Counter label="Items protected" value={stats ? compact(stats.tagsProtected) : "—"} />
          <Counter label="Items returned" value={stats ? compact(stats.itemsReturned) : "—"} />
          <Counter label="Average time to return" value={stats ? hours(stats.avgRecoveryHours) : "—"} />
          <Counter label="Finder reports sent" value={stats ? compact(stats.reportsSent) : "—"} />
        </div>
      </section>

      {/* How it works */}
      <section className="container-page mt-24" aria-labelledby="how-heading">
        <p className="eyebrow">How it works</p>
        <h2 id="how-heading" className="heading mt-3 text-3xl sm:text-4xl">
          Three steps, no phone numbers.
        </h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="sheet p-6">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-md bg-muted">
                  <Icon className="size-5 text-ink" aria-hidden="true" />
                </span>
                <span className="font-mono text-xs text-ink-3">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Privacy */}
      <section className="mt-24 border-y border-line bg-card" aria-labelledby="privacy-heading">
        <div className="container-page grid gap-10 py-16 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <ShieldCheck className="size-8 text-accent" aria-hidden="true" />
            <h2 id="privacy-heading" className="heading mt-4 text-3xl sm:text-4xl">
              Built so nobody learns who you are.
            </h2>
            <p className="mt-4 leading-relaxed text-ink-2">
              A tag is a random code, not your name. Codes can't be guessed or listed, reports are rate-limited and
              spam-checked, and you can block a sender with one tap.
            </p>
          </div>
          <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {PRIVACY.map(({ icon: Icon, title, body }) => (
              <li key={title}>
                <Icon className="size-5 text-ink" aria-hidden="true" />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Bulk */}
      <section className="container-page mt-24 grid items-center gap-8 md:grid-cols-[auto_1fr_auto]" aria-labelledby="bulk-heading">
        <span className="grid size-14 place-items-center rounded-lg bg-muted">
          <Building2 className="size-7 text-ink" aria-hidden="true" />
        </span>
        <div>
          <h2 id="bulk-heading" className="text-xl font-semibold">
            Schools, offices and luggage brands
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
            Pre-printed tag batches come with a private claim code inside the pack. Students, staff or customers scan
            to activate, with no setup on your side.
          </p>
        </div>
        <Link to={user ? "/claim" : "/login"} className="btn-secondary">
          <QrCode className="size-4" aria-hidden="true" />
          Claim a pre-printed tag
        </Link>
      </section>

      {/* Final CTA */}
      <section className="container-page mt-24">
        <div className="sheet flex flex-col items-start gap-6 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            <h2 className="heading text-2xl sm:text-3xl">Tag the things you'd hate to lose.</h2>
            <p className="mt-2 text-ink-2">Free for your first five tags. Takes about a minute.</p>
          </div>
          <Link to={startLink} className="btn-primary py-3">
            Get started
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
