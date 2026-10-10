// Inline error/success banners. aria-live so screen readers announce them when they appear.
export function ErrorNote({ children, className = "" }) {
  return (
    <div aria-live="assertive">
      {children && (
        <p className={`alert-error ${className}`} role="alert">
          {children}
        </p>
      )}
    </div>
  );
}

export function OkNote({ children, className = "" }) {
  return (
    <div aria-live="polite">
      {children && (
        <p className={`alert-ok ${className}`} role="status">
          {children}
        </p>
      )}
    </div>
  );
}
