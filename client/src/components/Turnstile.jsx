import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useTheme } from "../context/theme";
import { TURNSTILE_SITE_KEY } from "../utils/config";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = () => resolve(window.turnstile);
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("Couldn't load the CAPTCHA"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

// Cloudflare Turnstile, rendered only when VITE_TURNSTILE_SITE_KEY is set.
// Call ref.reset() after a failed submit, since each token can be used once.
const Turnstile = forwardRef(function Turnstile({ onToken }, ref) {
  const box = useRef(null);
  const widgetId = useRef(null);
  const onTokenRef = useRef(onToken);
  const { theme } = useTheme();

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useImperativeHandle(ref, () => ({
    reset() {
      if (window.turnstile && widgetId.current !== null) window.turnstile.reset(widgetId.current);
      onTokenRef.current("");
    },
  }));

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadScript()
      .then((turnstile) => {
        if (cancelled || !box.current) return;
        widgetId.current = turnstile.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme,
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => onTokenRef.current(""),
        });
      })
      .catch(() => onTokenRef.current(""));
    return () => {
      cancelled = true;
      if (window.turnstile && widgetId.current !== null) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [theme]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} className="min-h-[65px]" />;
});

export default Turnstile;
