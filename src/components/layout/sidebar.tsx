"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/practice", label: "Practice" },
  { href: "/practice/mock", label: "Mock Tests" },
  { href: "/profile", label: "Cognitive Fingerprint" },
  { href: "/history", label: "History" },
  { href: "/institute", label: "Institute" },
  { href: "/pricing", label: "Pricing" },
  { href: "/settings", label: "Settings" },
];

type Props = {
  userName: string;
  streak?: number;
  xp?: number;
  plan?: string;
  todayUsage?: number;
};

export function Sidebar({
  userName,
  streak = 0,
  xp = 0,
  plan = "free",
  todayUsage = 0,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const signOut = async () => {
    if (signingOut) return;
    if (!confirm("Sign out?")) return;
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const usageDisplay = plan === "free" ? `${todayUsage} / 5 today` : "Unlimited";

  const NavContent = () => (
    <>
      <div className="mb-6">
        <Link href="/dashboard" className="block">
          <p className="font-serif text-2xl text-white">Learning Loop</p>
          <p className="font-mono text-[10px] text-[#bda985] mt-1 tracking-widest uppercase">
            Reasoning-First Prep
          </p>
        </Link>
      </div>

      <nav className="space-y-1 flex-1 overflow-y-auto">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "block rounded-md px-3 py-2 text-sm transition",
              pathname === link.href || pathname.startsWith(link.href + "/")
                ? "bg-[#2f2618] text-white"
                : "text-[#bda985] hover:bg-[#1f180f]",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="mt-3 space-y-2 rounded-lg border border-[#3a2f1e] bg-[#1a130a] p-3 text-xs font-mono">
        <div className="flex justify-between">
          <span className="text-[#7e6e51]">Streak</span>
          <span className="text-white">{streak}d</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#7e6e51]">XP</span>
          <span className="text-white">{xp}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#7e6e51]">Plan</span>
          <span className="capitalize text-[var(--gold-light)]">{plan}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#7e6e51]">Usage</span>
          <span className="text-white">{usageDisplay}</span>
        </div>
        <div
          className="border-t border-[#2b2316] pt-2 truncate text-[#bda985]"
          title={userName}
        >
          {userName}
        </div>
        <button
          onClick={signOut}
          disabled={signingOut}
          className="w-full mt-1 rounded border border-[#3a2f1e] py-1.5 text-[10px] uppercase tracking-widest text-[#bda985] hover:bg-[#2f2618] hover:text-white disabled:opacity-50"
        >
          {signingOut ? "..." : "Sign out"}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[var(--sidebar)] border-b border-[#2b2316] px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard">
          <p className="font-serif text-xl text-white">Learning Loop</p>
        </Link>
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="text-[#bda985] hover:text-white p-1"
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile overlay drawer */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 h-screen w-[260px] bg-[var(--sidebar)] text-[var(--gold-light)] p-4 border-r border-[#2b2316] flex flex-col z-40 transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-2 flex justify-end">
          <button
            onClick={() => setMobileOpen(false)}
            className="text-[#7e6e51] hover:text-white p-1"
            aria-label="Close menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <NavContent />
      </aside>

      {/* Desktop fixed sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[220px] bg-[var(--sidebar)] text-[var(--gold-light)] p-4 border-r border-[#2b2316] flex-col">
        <NavContent />
      </aside>
    </>
  );
}
