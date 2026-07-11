"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Optimistically ready: even if no PASSWORD_RECOVERY event fires the user can
  // still submit — Supabase rejects the update if the recovery session is
  // invalid. Starting true avoids a synchronous setState inside the effect.
  const [ready, setReady] = useState(true);

  useEffect(() => {
    // Supabase emits a PASSWORD_RECOVERY auth event when arriving from the email link.
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  if (!ready) {
    return (
      <div className="max-w-md mx-auto px-6 py-20">
        <p className="text-[var(--muted)] font-mono text-sm">Verifying recovery link...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <h1 className="font-serif text-4xl">Set a new password</h1>
      <form onSubmit={submit} className="paper-card p-5 mt-6 space-y-4">
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-3 outline-none focus:border-[var(--gold)]"
        />
        <input
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          className="w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-3 outline-none focus:border-[var(--gold)]"
        />
        {error && <p className="text-sm text-[var(--red)] font-mono">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary w-full"
        >
          {busy ? "Saving..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
