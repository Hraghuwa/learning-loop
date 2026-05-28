"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    if (busy) return;
    if (!confirm("Sign out of Learning Loop?")) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <button
      onClick={logout}
      disabled={busy}
      className="block w-full text-left rounded border border-[var(--red)]/30 text-[var(--red)] bg-[var(--red)]/5 px-4 py-2.5 text-sm hover:bg-[var(--red)]/10 disabled:opacity-50"
    >
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
