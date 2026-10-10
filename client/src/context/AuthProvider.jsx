import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client";
import { AuthContext } from "./auth";

const storage = {
  get: () => {
    try {
      return localStorage.getItem("token");
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      localStorage.setItem("token", token);
    } catch {
      // Private browsing can block storage; the session then lasts for this tab only
    }
  },
  clear: () => {
    try {
      localStorage.removeItem("token");
    } catch {
      // Nothing saved, nothing to clear
    }
  },
};

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // true until we've checked whether a saved token is still valid
  const [loading, setLoading] = useState(() => Boolean(storage.get()));

  const logout = useCallback(() => {
    storage.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    if (!storage.get()) return;
    api
      .get("/auth/me")
      .then(({ data }) => setUser(data.user))
      .catch(logout)
      .finally(() => setLoading(false));
  }, [logout]);

  // Any 401 from a protected route means the token expired: sign the user out.
  // Finder (/public/) routes have their own token, so their 401s never end the owner's session.
  useEffect(() => {
    const id = api.interceptors.response.use(undefined, (err) => {
      const url = err.config?.url || "";
      const ignore = url.startsWith("/auth/login") || url.startsWith("/auth/register") || url.startsWith("/public/");
      if (err.response?.status === 401 && !ignore) logout();
      return Promise.reject(err);
    });
    return () => api.interceptors.response.eject(id);
  }, [logout]);

  const saveSession = useCallback(({ token, user }) => {
    storage.set(token);
    setUser(user);
  }, []);

  const login = useCallback(
    async (email, password) => saveSession((await api.post("/auth/login", { email, password })).data),
    [saveSession]
  );

  const register = useCallback(
    async (name, email, password) =>
      saveSession((await api.post("/auth/register", { name, email, password })).data),
    [saveSession]
  );

  // Settings changes come back as the fresh user object
  const updateUser = useCallback((next) => setUser(next), []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, updateUser }),
    [user, loading, login, register, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
