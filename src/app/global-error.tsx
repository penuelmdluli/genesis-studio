"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: "#07070A", color: "#fff", margin: 0 }}>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}>
          <div style={{ textAlign: "center", maxWidth: "28rem" }}>
            <div style={{
              width: "5rem",
              height: "5rem",
              borderRadius: "1rem",
              background: "linear-gradient(135deg, #dc2626, #f97316)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: "1.875rem",
              margin: "0 auto 2rem",
            }}>
              !
            </div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "1rem" }}>
              Something went wrong
            </h1>
            <p style={{ color: "#a1a1aa", marginBottom: "2rem" }}>
              An unexpected error occurred. Please try again.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={reset}
                style={{
                  padding: "0.75rem 1.5rem",
                  borderRadius: "0.75rem",
                  background: "linear-gradient(to right, #7c3aed, #8b5cf6)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
              <a
                href="/"
                style={{
                  padding: "0.75rem 1.5rem",
                  borderRadius: "0.75rem",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#d4d4d8",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  textDecoration: "none",
                }}
              >
                Go Home
              </a>
            </div>
            {error.digest && (
              <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#52525b" }}>
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
