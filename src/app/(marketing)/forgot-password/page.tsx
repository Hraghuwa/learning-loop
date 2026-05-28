"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <h1 className="font-serif text-4xl">Forgot password</h1>
      <p className="text-[var(--muted)] mt-2 text-sm">
        We&rsquo;ll email you a one-time link to reset it.
      </p>

      {sent ? (
        <div className="paper-card p-5 mt-6">
          <p className="font-serif text-lg">Check your email.</p>
          <p className="text-sm text-[var(--muted)] mt-1">
            We&rsquo;ve sent a reset link to {email}. The link expires in 60 minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="paper-card p-5 mt-6 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-3 outline-none focus:border-[var(--gold)]"
          />
          {error && <p className="text-sm text-[var(--red)] font-mono">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded bg-[var(--gold)] text-white py-3 font-mono text-sm disabled:opacity-50"
          >
            {busy ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}
    </div>
  );
}
