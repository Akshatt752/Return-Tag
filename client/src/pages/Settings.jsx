import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff, Crown, LogOut, Mail, Smartphone } from "lucide-react";
import api, { getErrorMessage } from "../api/client";
import { useAuth } from "../context/auth";
import { ErrorNote, OkNote } from "../components/ErrorNote";
import Spinner from "../components/Spinner";

const pushSupported =
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// navigator.serviceWorker.ready never resolves when no worker is registered (e.g. `npm run dev`),
// so look the registration up directly instead
async function getRegistration() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error("no-sw");
  return reg;
}

function Toggle({ id, checked, onChange, disabled, label, description, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden="true" />
        <div>
          <label htmlFor={id} className="text-sm font-medium">
            {label}
          </label>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{description}</p>
        </div>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${
          checked ? "bg-accent" : "bg-line-strong"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`}
        />
      </button>
    </div>
  );
}

function DevicePush() {
  const [publicKey, setPublicKey] = useState(undefined); // undefined = loading, null = not configured
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const reg = await getRegistration();
      setSubscribed(Boolean(await reg.pushManager.getSubscription()));
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    if (!pushSupported) return;
    api
      .get("/push/key")
      .then(({ data }) => setPublicKey(data.publicKey || null))
      .catch(() => setPublicKey(null));
    refresh();
  }, [refresh]);

  if (!pushSupported || !publicKey) return null;

  const enable = async () => {
    setError("");
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("denied");
      const reg = await getRegistration();
      // The browser's push service can stall (offline, blocked network); don't spin forever
      const sub = await Promise.race([
        reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 45000)),
      ]);
      await api.post("/push/subscribe", { subscription: sub.toJSON() });
      setSubscribed(true);
    } catch (err) {
      if (err.message === "denied") setError("Notifications are blocked for this site. Allow them in your browser settings.");
      else if (err.message === "no-sw") setError("Push needs the installed app or the production build (the service worker isn't running in dev mode).");
      else if (err.message === "timeout") setError("Couldn't reach your browser's push service. Check your connection and try again.");
      else setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setError("");
    setBusy(true);
    try {
      const reg = await getRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.post("/push/unsubscribe", { endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-line py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm">
          <Smartphone className="size-4 text-ink-3" aria-hidden="true" />
          {subscribed ? "Push is on for this device." : "This device isn't receiving push notifications."}
        </p>
        <button type="button" className="btn-secondary btn-sm" onClick={subscribed ? disable : enable} disabled={busy}>
          {busy ? (
            <Spinner className="size-3.5" />
          ) : subscribed ? (
            <BellOff className="size-3.5" aria-hidden="true" />
          ) : (
            <Bell className="size-3.5" aria-hidden="true" />
          )}
          {subscribed ? "Turn off on this device" : "Enable push on this device"}
        </button>
      </div>
      <ErrorNote className="mt-3">{error}</ErrorNote>
    </div>
  );
}

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user.name);
  const [nameState, setNameState] = useState({ busy: false, ok: "", error: "" });
  const [notifyError, setNotifyError] = useState("");
  const [notifyBusy, setNotifyBusy] = useState(false);

  const saveName = async (e) => {
    e.preventDefault();
    setNameState({ busy: true, ok: "", error: "" });
    try {
      const { data } = await api.patch("/auth/me", { name: name.trim() });
      updateUser(data.user);
      setNameState({ busy: false, ok: "Saved.", error: "" });
    } catch (err) {
      setNameState({ busy: false, ok: "", error: getErrorMessage(err) });
    }
  };

  const setNotify = async (key, value) => {
    setNotifyError("");
    setNotifyBusy(true);
    try {
      const { data } = await api.patch("/auth/me", { notify: { [key]: value } });
      updateUser(data.user);
    } catch (err) {
      setNotifyError(getErrorMessage(err));
    } finally {
      setNotifyBusy(false);
    }
  };

  const signOut = () => {
    logout();
    navigate("/");
  };

  const premium = user.plan === "premium";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-14">
      <p className="eyebrow">Settings</p>
      <h1 className="heading mt-2 text-4xl">Your account</h1>

      <section className="sheet mt-8 p-5 sm:p-6" aria-labelledby="profile-heading">
        <h2 id="profile-heading" className="text-sm font-semibold">
          Profile
        </h2>
        <form onSubmit={saveName} className="mt-4 space-y-4">
          <div>
            <label htmlFor="settings-name" className="label">
              Name
            </label>
            <div className="flex gap-2">
              <input id="settings-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
              <button type="submit" className="btn-secondary shrink-0" disabled={nameState.busy || name.trim() === user.name}>
                {nameState.busy ? <Spinner className="size-4" /> : "Save"}
              </button>
            </div>
            <p className="hint">Only you see this. Finders always see you as “Owner”.</p>
          </div>
          <OkNote>{nameState.ok}</OkNote>
          <ErrorNote>{nameState.error}</ErrorNote>
          <p className="text-sm text-ink-2">
            Email: <span className="text-ink">{user.email}</span>
          </p>
        </form>
      </section>

      <section className="sheet mt-4 px-5 pt-3 pb-1 sm:px-6" aria-labelledby="notify-heading">
        <h2 id="notify-heading" className="pt-2 text-sm font-semibold">
          Notifications
        </h2>
        <div className="divide-y divide-line">
          <Toggle
            id="notify-email"
            icon={Mail}
            label="Email"
            description="When someone reports finding your item or replies. Emails never include the finder's details."
            checked={Boolean(user.notify?.email)}
            disabled={notifyBusy}
            onChange={(v) => setNotify("email", v)}
          />
          <Toggle
            id="notify-push"
            icon={Bell}
            label="Push notifications"
            description="Instant alerts on devices where you've enabled push."
            checked={Boolean(user.notify?.push)}
            disabled={notifyBusy}
            onChange={(v) => setNotify("push", v)}
          />
          {user.notify?.push && <DevicePush />}
        </div>
        <ErrorNote className="mb-4">{notifyError}</ErrorNote>
      </section>

      <section className="sheet mt-4 p-5 sm:p-6" aria-labelledby="plan-heading">
        <h2 id="plan-heading" className="flex items-center gap-2 text-sm font-semibold">
          <Crown className={`size-4 ${premium ? "text-tag" : "text-ink-3"}`} aria-hidden="true" />
          Plan: {premium ? "Premium" : "Free"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          {user.tagLimit === null
            ? "Unlimited tags."
            : `Up to ${user.tagLimit} tags. Premium removes the limit, and bulk plans are available for schools and businesses. Contact us to upgrade.`}
        </p>
      </section>

      <button type="button" className="btn-secondary mt-8" onClick={signOut}>
        <LogOut className="size-4" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}
