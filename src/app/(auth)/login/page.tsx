"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) return setError(authError.message);
    router.push("/dashboard");
    router.refresh();
  };

  const onGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[var(--paper)] p-6">
      <form onSubmit={onSubmit} className="paper-card w-full max-w-md p-6 space-y-4">
        <h1 className="font-serif text-3xl">Welcome back</h1>
        <input className="w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-3" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-[var(--red)]">{error}</p>}
        <button className="w-full rounded bg-[var(--gold)] p-3 text-white">Login</button>
        <button type="button" onClick={onGoogle} className="w-full rounded border border-[var(--border)] p-3">Continue with Google</button>
      </form>
    </div>
  );
}
