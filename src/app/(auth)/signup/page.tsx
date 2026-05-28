"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupShell />}>
      <SignupInner />
    </Suspense>
  );
}

function SignupShell() {
  return (
    <div className="min-h-screen grid place-items-center bg-[var(--paper)] p-6">
      <div className="paper-card w-full max-w-md p-6 text-[var(--muted)] font-mono text-sm">
        Loading...
      </div>
    </div>
  );
}

function SignupInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/onboarding";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setBusy(false);
      return;
    }
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (authError) {
      setError(authError.message);
      setBusy(false);
      return;
    }
    // session is null when Supabase requires email confirmation
    if (!data.session) {
      setConfirmEmail(true);
      setBusy(false);
      return;
    }
    if (data.user) {
      try {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bootstrap: true, name }),
        });
      } catch {
        // best-effort; onboarding will reconcile
      }
    }
    router.push(next);
    router.refresh();
  };

  const onGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  };

  if (confirmEmail) {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--paper)] p-6">
        <div className="paper-card w-full max-w-md p-6 space-y-4 text-center">
          <p className="font-serif text-3xl">Check your email</p>
          <p className="text-sm text-[var(--muted)]">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then come back to log in.
          </p>
          <Link href="/login" className="block w-full rounded bg-[var(--gold)] p-3 text-white text-center">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

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
          <h1 className="font-serif text-3xl">Create your account</h1>
          <input
            className="w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-3"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
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
            placeholder="Password (min 8 chars)"
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-[var(--red)] font-mono">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-[var(--gold)] p-3 text-white disabled:opacity-50"
          >
            {busy ? "Creating account..." : "Sign up"}
          </button>
          <button
            type="button"
            onClick={onGoogle}
            className="w-full rounded border border-[var(--border)] p-3"
          >
            Continue with Google
          </button>
          <p className="text-xs text-[var(--muted)] text-center">
            By signing up you agree to our{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--muted)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--gold)] hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
