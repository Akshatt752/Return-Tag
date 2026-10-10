import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Inbox, LayoutDashboard, LogOut, ScanLine, Settings, Shield } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/auth";
import ThemeToggle from "./ThemeToggle";
import Wordmark from "./Wordmark";

const linkClass = ({ isActive }) =>
  `relative inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition focus-visible:outline-2 focus-visible:outline-accent ${
    isActive ? "bg-muted text-ink" : "text-ink-2 hover:bg-muted hover:text-ink"
  }`;

const iconButton =
  "grid size-9 place-items-center rounded-md text-ink-2 transition hover:bg-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent";

function useUnreadCount(user) {
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);

  // Cheap enough to refresh on every page change, which is when the badge matters
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    api
      .get("/stats/me")
      .then(({ data }) => !cancelled && setUnread(data.reports?.unread || 0))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  return user ? unread : 0;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const unread = useUnreadCount(user);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <header className="no-print sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md">
      <nav className="container-page flex h-16 items-center justify-between gap-2">
        <Wordmark to={user ? "/dashboard" : "/"} className="text-lg sm:text-xl" />

        <div className="flex items-center gap-0.5 sm:gap-1.5">
          {user ? (
            <>
              <NavLink to="/dashboard" className={linkClass} aria-label="Dashboard">
                <LayoutDashboard className="size-[18px]" aria-hidden="true" />
                <span className="hidden sm:inline">Dashboard</span>
              </NavLink>
              <NavLink to="/inbox" className={linkClass} aria-label={unread ? `Inbox, ${unread} unread` : "Inbox"}>
                <Inbox className="size-[18px]" aria-hidden="true" />
                <span className="hidden sm:inline">Inbox</span>
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 grid min-w-[18px] place-items-center rounded-full bg-accent px-1 font-mono text-[10px] leading-[18px] font-semibold text-white sm:static sm:ml-0.5 dark:text-paper">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </NavLink>
              {user.role === "admin" && (
                <NavLink to="/admin" className={linkClass} aria-label="Admin">
                  <Shield className="size-[18px]" aria-hidden="true" />
                  <span className="hidden md:inline">Admin</span>
                </NavLink>
              )}
              <ThemeToggle />
              <NavLink to="/settings" className={iconButton} aria-label="Settings" title="Settings">
                <Settings className="size-[18px]" aria-hidden="true" />
              </NavLink>
              <button onClick={handleLogout} className={iconButton} aria-label="Log out" title="Log out">
                <LogOut className="size-[18px]" aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <Link to="/found" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-2 transition hover:bg-muted hover:text-ink">
                <ScanLine className="size-[18px]" aria-hidden="true" />
                <span className="hidden sm:inline">Found an item?</span>
                <span className="sr-only sm:hidden">Found an item?</span>
              </Link>
              <span className="hidden sm:inline-flex">
                <ThemeToggle />
              </span>
              <Link to="/login" className="px-2 py-1 text-sm text-ink-2 transition hover:text-ink">
                Log in
              </Link>
              <Link to="/register" className="btn-primary px-3.5 py-2 sm:px-4">
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
