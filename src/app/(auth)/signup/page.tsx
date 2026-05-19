"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (authError) return setError(authError.message);
    if (data.user) {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bootstrap: true, name }),
      });
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[var(--paper)] p-6">
      <form onSubmit={onSubmit} className="paper-card w-full max-w-md p-6 space-y-4">
        <h1 className="font-serif text-3xl">Create your account</h1>
        <input className="w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-3" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full rounded border border-[var(--border)] bg-[var(--paper2)] p-3" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-[var(--red)]">{error}</p>}
        <button className="w-full rounded bg-[var(--gold)] p-3 text-white">Sign up</button>
      </form>
    </div>
  );
}
