// Cloudflare Turnstile. Optional: without TURNSTILE_SECRET_KEY the honeypot, timing check
// and rate limits still apply.
export async function verifyCaptcha(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (typeof token !== "string" || !token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error("Turnstile verification failed:", err.message);
    return false;
  }
}
