import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--paper)]">
      <header className="border-b border-[var(--border)] bg-[var(--paper)]/90 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-serif text-2xl">Learning Loop</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] hidden sm:inline">
              Reasoning-First Prep
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4 text-sm">
            <Link href="/pricing" className="hover:text-[var(--gold)]">Pricing</Link>
            <Link href="/about" className="hidden sm:inline hover:text-[var(--gold)]">About</Link>
            {user ? (
              <Link href="/dashboard" className="btn btn-primary btn-sm">
                Open dashboard →
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hover:text-[var(--gold)] hidden sm:inline"
                >
                  Login
                </Link>
                <Link href="/signup" className="btn btn-primary btn-sm">
                  Get started →
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--border)] bg-[var(--paper2)] mt-16">
        <div className="max-w-6xl mx-auto px-6 py-8 grid md:grid-cols-4 gap-6 text-sm">
          <div>
            <p className="font-serif text-xl">Learning Loop</p>
            <p className="text-[var(--muted)] mt-1 text-xs">
              The reasoning-first CAT prep platform.
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-2">
              Product
            </p>
            <ul className="space-y-1">
              <li><Link href="/pricing" className="hover:text-[var(--gold)]">Pricing</Link></li>
              <li><Link href="/about" className="hover:text-[var(--gold)]">About</Link></li>
              <li><Link href="/login" className="hover:text-[var(--gold)]">Login</Link></li>
              <li><Link href="/signup" className="hover:text-[var(--gold)]">Sign up</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-2">
              Legal
            </p>
            <ul className="space-y-1">
              <li><Link href="/terms" className="hover:text-[var(--gold)]">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-[var(--gold)]">Privacy Policy</Link></li>
              <li><Link href="/refund" className="hover:text-[var(--gold)]">Refund Policy</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] mb-2">
              Contact
            </p>
            <p className="text-[var(--muted)] text-xs">
              hello@learningloop.in
            </p>
          </div>
        </div>
        <div className="border-t border-[var(--border)] py-4 text-center font-mono text-[10px] text-[var(--muted)]">
          © {new Date().getFullYear()} Learning Loop. Built for thinkers.
        </div>
      </footer>
    </div>
  );
}
