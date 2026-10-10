import axios from "axios";

// Locally, Vite proxies /api to the Express server. In production set VITE_API_URL
// to the deployed backend, e.g. https://your-api.onrender.com/api
// (the "/api" suffix is added automatically if it was left off)
function resolveBaseURL() {
  const url = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
  if (!url) return "/api";
  return url.endsWith("/api") ? url : `${url}/api`;
}

const api = axios.create({ baseURL: resolveBaseURL() });

function readToken() {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
}

api.interceptors.request.use((config) => {
  // Finder routes authenticate with X-Finder-Token instead, and never need the owner's session
  const token = readToken();
  if (token && !config.url?.startsWith("/public/")) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Finder requests carry their private report token in a header, never in the URL
export const finderHeaders = (token) => ({ headers: { "X-Finder-Token": token } });

export function getErrorMessage(err) {
  if (err.response?.data?.message) return err.response.data.message;
  if (err.response?.status === 429) return "Too many requests. Please wait a few minutes and try again.";
  if (err.code === "ERR_NETWORK") return "Can't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

export default api;
