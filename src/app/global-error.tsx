"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "#fff9f5",
            color: "#0a1620",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              padding: 24,
              maxWidth: 360,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 8px 24px -12px rgba(10,22,32,0.12)",
            }}
          >
            <div style={{ fontSize: 44 }}>🎾</div>
            <h1 style={{ fontSize: 22, margin: "8px 0" }}>
              Something broke hard.
            </h1>
            <p style={{ color: "#6b7a84", fontSize: 14 }}>
              Refresh the page or come back in a moment.
            </p>
            <button
              onClick={reset}
              style={{
                marginTop: 16,
                padding: "10px 16px",
                borderRadius: 999,
                background: "#ff7fa3",
                color: "white",
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
