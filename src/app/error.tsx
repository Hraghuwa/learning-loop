"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[learning-loop] global error:", error);
  }, [error]);

  return (
    <div className="min-h-screen grid place-items-center bg-[var(--paper)] p-6">
      <div className="text-center max-w-md">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--red)]">
          Something broke
        </p>
        <h1 className="font-serif text-4xl mt-1">A loop snagged.</h1>
        <p className="text-[var(--muted)] mt-3 text-sm">
          We logged it. Try the action again, or head back to the dashboard.
        </p>
        {error?.digest && (
          <p className="mt-2 font-mono text-[10px] text-[var(--muted)]">
            ref: {error.digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="btn btn-primary btn-sm"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded border border-[var(--border)] px-5 py-2 font-mono text-sm"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
