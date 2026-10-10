import { Link } from "react-router-dom";

export default function NotFound({ title = "Nothing tagged here.", note = "The link may be old, or the page was moved." }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-28 text-center">
      <p className="code text-xs text-accent">404</p>
      <h1 className="heading mt-4 text-4xl sm:text-5xl">{title}</h1>
      <p className="mt-4 text-ink-2">{note}</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn-primary">
          Back to the start
        </Link>
        <Link to="/found" className="btn-secondary">
          Enter a tag code
        </Link>
      </div>
    </div>
  );
}
