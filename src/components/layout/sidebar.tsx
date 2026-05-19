"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/practice", label: "Practice" },
  { href: "/profile", label: "Cognitive Fingerprint" },
  { href: "/history", label: "History" },
  { href: "/institute", label: "Institute" },
  { href: "/pricing", label: "Pricing" },
];

export function Sidebar({
  userName,
  streak = 0,
  xp = 0,
}: {
  userName: string;
  streak?: number;
  xp?: number;
}) {
  const pathname = usePathname();
  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-[var(--sidebar)] text-[var(--gold-light)] p-4 border-r border-[#2b2316]">
      <div className="mb-8">
        <p className="font-serif text-2xl text-white">Learning Loop</p>
        <p className="font-mono text-xs text-[#bda985] mt-1">REASONING-FIRST PREP</p>
      </div>
      <nav className="space-y-1">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "block rounded-md px-3 py-2 text-sm transition",
              pathname === link.href ? "bg-[#2f2618] text-white" : "text-[#bda985] hover:bg-[#1f180f]",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="absolute bottom-4 left-4 right-4 space-y-2 rounded-lg border border-[#3a2f1e] bg-[#1a130a] p-3 text-xs font-mono">
        <div>Streak: {streak} days</div>
        <div>XP: {xp}</div>
        <div className="truncate text-[#bda985]">{userName}</div>
      </div>
    </aside>
  );
}
