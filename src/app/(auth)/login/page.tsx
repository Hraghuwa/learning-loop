"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginShell() {
  return (
    <div className="min-h-screen grid place-items-center bg-[var(--paper)] p-6">
      <div className="paper-card w-full max-w-md p-6 text-[var(--muted)] font-mono text-sm">
        Loading...
      </div>
    </div>
  );
}

function LoginInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      if (authError.message.toLowerCase().includes("email not confirmed")) {
        setError("Please confirm your email address before logging in. Check your inbox for the confirmation link.");
      } else if (authError.message.toLowerCase().includes("invalid login credentials")) {
        setError("Invalid email or password. Please try again or create a new account.");
      } else {
        setError(authError.message);
      }
      setBusy(false);
      return;
    }
    // Full navigation ensures the session cookie is sent with the new request
    // before the server evaluates auth. Using router.push + router.refresh
    // together causes a race where the server re-renders the login page before
    // the session propagates, resulting in a redirect loop.
    window.location.href = next;
  };

  const onGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[var(--paper)] p-6">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center mb-6">
          <p className="font-serif text-3xl">Learning Loop</p>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)]">
            Reasoning-First Prep
          </p>
        </Link>
        <form onSubmit={onSubmit} className="paper-card w-full p-6 space-y-4">
          <h1 className="font-serif text-3xl">Welcome back</h1>
          <input
            className="w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-3"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-3"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div className="flex justify-between text-xs">
            <Link href="/forgot-password" className="text-[var(--gold)] hover:underline">
              Forgot password?
            </Link>
          </div>
          {error && <p className="text-sm text-[var(--red)] font-mono">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-[var(--gold)] p-3 text-white disabled:opacity-50"
          >
            {busy ? "Signing in..." : "Login"}
          </button>
          <button
            type="button"
            onClick={onGoogle}
            className="w-full rounded border border-[var(--border)] p-3"
          >
            Continue with Google
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          New here?{" "}
          <Link href="/signup" className="text-[var(--gold)] hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
