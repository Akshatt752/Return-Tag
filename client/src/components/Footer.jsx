import { Link } from "react-router-dom";
import { useAuth } from "../context/auth";
import { ThemeSwitch } from "./ThemeToggle";
import Wordmark from "./Wordmark";

const YEAR = new Date().getFullYear();

function Column({ title, children }) {
  return (
    <div>
      <h3 className="eyebrow">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm">{children}</ul>
    </div>
  );
}

export default function Footer() {
  const { user } = useAuth();
  const internal = "text-ink-2 transition hover:text-ink";

  return (
    <footer className="no-print mt-24 border-t border-line">
      <div className="container-page grid grid-cols-2 gap-x-6 gap-y-10 py-14 sm:grid-cols-3 lg:grid-cols-[1.6fr_1fr_1fr]">
        <div className="col-span-2 sm:col-span-1">
          <Wordmark className="text-xl" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-2">
            QR tags for the things you carry. Whoever finds your item can reach you, and never sees who you are.
          </p>
        </div>

        <Column title="For finders">
          <li>
            <Link to="/found" className={internal}>
              Enter a tag code
            </Link>
          </li>
          <li>
            <Link to="/found" className={internal}>
              Reports you've sent
            </Link>
          </li>
        </Column>

        <Column title="For owners">
          <li>
            <Link to={user ? "/tags/new" : "/register"} className={internal}>
              Create a tag
            </Link>
          </li>
          <li>
            <Link to={user ? "/claim" : "/login"} className={internal}>
              Claim a pre-printed tag
            </Link>
          </li>
          <li>
            <Link to={user ? "/dashboard" : "/login"} className={internal}>
              Your dashboard
            </Link>
          </li>
        </Column>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-relaxed text-ink-3">
            © {YEAR} ReturnTag. Finders never see your name, email or phone, and you never see theirs.
          </p>
          <ThemeSwitch />
        </div>
      </div>
    </footer>
  );
}
