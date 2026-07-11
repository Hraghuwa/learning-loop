"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function UpgradeBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Derive visibility from the URL at mount instead of syncing via setState in
  // an effect (react-hooks/set-state-in-effect). The effect below only performs
  // the external side-effect: stripping the query param from the address bar.
  const [show, setShow] = useState(() => searchParams.get("upgraded") === "1");

  useEffect(() => {
    if (searchParams.get("upgraded") === "1") {
      const url = new URL(window.location.href);
      url.searchParams.delete("upgraded");
      router.replace(url.pathname + (url.search || ""), { scroll: false });
    }
  }, [searchParams, router]);

  if (!show) return null;

  return (
    <div className="paper-card p-4 border-l-4 border-l-[var(--green)] bg-[var(--green)]/5 flex items-start justify-between gap-4">
      <div>
        <p className="font-serif text-xl text-[var(--green)]">You&rsquo;re on Pro now.</p>
        <p className="text-sm text-[var(--muted)] mt-1">
          Unlimited AI diagnoses, multi-turn tutor, 4-week study plan, and full mock access are unlocked.
        </p>
      </div>
      <button
        onClick={() => setShow(false)}
        className="text-[var(--muted)] hover:text-[var(--ink)] font-mono text-xs shrink-0"
      >
        Dismiss
      </button>
    </div>
  );
}
