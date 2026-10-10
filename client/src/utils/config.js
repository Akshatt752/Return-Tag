// Optional Cloudflare Turnstile site key; the CAPTCHA only renders when it's set
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();
