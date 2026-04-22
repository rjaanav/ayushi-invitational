"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, Home } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex-1 min-h-[80dvh] flex items-center justify-center px-6">
      <div className="card p-6 max-w-sm w-full text-center flex flex-col items-center gap-3">
        <div className="text-5xl" aria-hidden>
          🎾
        </div>
        <h1 className="font-display text-2xl leading-tight">
          That rally went <span className="text-pink-500">out</span>.
        </h1>
        <p className="text-sm text-muted">
          Something broke on our end. Give it another swing.
        </p>
        {error?.digest && (
          <p className="text-[10px] font-mono text-muted/70 mt-1">
            id: {error.digest}
          </p>
        )}
        <div className="flex gap-2 mt-2 w-full">
          <button onClick={reset} className="btn btn-primary flex-1">
            <RefreshCw size={14} /> Try again
          </button>
          <Link href="/" className="btn btn-ghost flex-1">
            <Home size={14} /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
