import { useEffect, useRef } from "react";

// Calls `fn` every `ms` while the tab is visible, and once more as soon as it becomes visible again.
// Pass `enabled = false` to pause (e.g. until the first load succeeds).
export default function usePolling(fn, ms = 10000, enabled = true) {
  const saved = useRef(fn);

  useEffect(() => {
    saved.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === "visible") saved.current();
    };
    const id = setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [ms, enabled]);
}
