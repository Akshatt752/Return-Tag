import { useEffect, useMemo, useState } from "react";
import { ThemeContext } from "./theme";

const query = window.matchMedia("(prefers-color-scheme: dark)");

function readSaved() {
  try {
    const saved = localStorage.getItem("theme");
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
}

// preference is what the user picked ("system" | "light" | "dark");
// theme is what's actually showing ("light" | "dark")
export default function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readSaved);
  const [systemDark, setSystemDark] = useState(query.matches);

  useEffect(() => {
    const onChange = (e) => setSystemDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const theme = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    try {
      if (preference === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", preference);
    } catch {
      // Private browsing can block storage; the theme still works for this visit
    }
  }, [preference]);

  const value = useMemo(
    () => ({
      theme,
      preference,
      setPreference,
      toggle: () => setPreference(theme === "dark" ? "light" : "dark"),
    }),
    [theme, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
