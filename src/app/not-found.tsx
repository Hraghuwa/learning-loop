import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center bg-[var(--paper)] p-6">
      <div className="text-center max-w-md">
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
          404
        </p>
        <h1 className="font-serif text-5xl mt-1">This page is off the loop</h1>
        <p className="text-[var(--muted)] mt-3">
          The page you&rsquo;re looking for doesn&rsquo;t exist, was moved, or never made
          it past a draft.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/"
            className="btn btn-primary btn-sm"
          >
            Back to home
          </Link>
          <Link
            href="/dashboard"
            className="rounded border border-[var(--border)] px-5 py-2 font-mono text-sm"
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
