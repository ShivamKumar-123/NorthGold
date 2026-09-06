'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowDownToLine, LayoutDashboard, LogOut, Menu, Network,
  PiggyBank, ShieldCheck, User as UserIcon, Wallet, X,
} from 'lucide-react';

import Logo from '@/components/Logo';
import SupportChat from '@/components/SupportChat';
import ThemeToggle from '@/components/ThemeToggle';
import { money } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/investments', label: 'Investments', icon: PiggyBank },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/referrals', label: 'My Network', icon: Network },
];

/**
 * Sidebar layout for the signed-in app.
 *
 * The marketing pages keep the horizontal header (see Chrome.tsx) — a sidebar
 * belongs to the application, not to the landing page.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer covers the page.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!user) return <>{children}</>;

  const kycPending = user.kyc_status !== 'approved';

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside
        className={`tex-sidebar on-dark fixed inset-y-0 left-0 z-50 flex w-[268px] shrink-0 flex-col
                    border-r border-border transition-transform duration-300
                    lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          boxShadow: '1px 0 0 rgba(255,255,255,.04), 18px 0 50px -30px rgba(0,0,0,.9)',
        }}
      >
        <div className="flex h-[74px] shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <Link href="/dashboard" className="flex items-center transition-transform duration-300 hover:scale-[1.03]">
            <Logo className="h-11" priority />
          </Link>
          <ThemeToggle className="h-9 w-9" />
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-text-muted hover:bg-white/5 hover:text-text lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Wallet — the one raised object in the sidebar. */}
        <div className="px-3 pt-4">
          <Link
            href="/wallet"
            className="panel group block overflow-hidden rounded-2xl p-4 transition-all duration-300
                       hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-e3"
          >
            <span
              className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-success/25 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
              aria-hidden
            />
            <p className="relative text-[10px] uppercase tracking-[0.14em] text-text-dim">
              Available balance
            </p>
            <p className="relative mt-1 text-xl font-semibold tabular-nums text-success">
              {money(user.wallet_balance)}
            </p>
            <p className="relative mt-2.5 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[11px] text-text-muted">
              <span>Invested</span>
              <span className="tabular-nums text-text">{money(user.invested_balance)}</span>
            </p>
          </Link>
        </div>

        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`tex-navlink group relative flex items-center gap-3 overflow-hidden rounded-xl
                            px-3 py-2.5 text-sm transition-all duration-200 ${
                  active
                    ? 'tex-navlink-active font-medium text-accent'
                    : 'text-text-muted hover:translate-x-0.5 hover:text-text'
                }`}
              >
                <span
                  className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent
                              transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`}
                  aria-hidden
                />
                <Icon size={17} className="shrink-0" />
                {label}
              </Link>
            );
          })}

          {kycPending && (
            <Link
              href="/profile"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-warn/25 bg-warn-soft p-3
                         text-xs leading-relaxed text-warn shadow-e1 transition hover:border-warn/40"
            >
              <ShieldCheck size={14} className="mt-px shrink-0" />
              <span>
                Your KYC is <strong>{user.kyc_status}</strong>. Complete it to keep
                withdrawals running smoothly.
              </span>
            </Link>
          )}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <Link
            href="/profile"
            className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-white/[0.045]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/20 text-sm font-semibold text-accent shadow-e1">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-text">{user.name}</span>
              <span className="block truncate font-mono text-[11px] text-accent">
                {user.referral_code}
              </span>
            </span>
            <UserIcon size={15} className="shrink-0 text-text-dim" />
          </Link>

          <button
            onClick={logout}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm
                       text-danger transition hover:bg-danger/10"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* ── Content ──────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[74px] items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-xl lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-xl border border-border p-2 text-text-muted shadow-btn-3d-ghost hover:text-text"
            aria-label="Open navigation"
            aria-expanded={open}
          >
            <Menu size={18} />
          </button>

          <Link href="/dashboard" className="flex items-center">
            <Logo variant="mark" className="h-10" priority />
          </Link>

          <Link href="/wallet" className="card ml-auto px-3 py-1.5 text-right">
            <span className="block text-[9px] uppercase tracking-[0.12em] text-text-dim">Wallet</span>
            <span className="block text-sm font-semibold tabular-nums text-success">
              {money(user.wallet_balance)}
            </span>
          </Link>
        </header>

        <main className="tex-app min-w-0 flex-1">{children}</main>

        <footer className="tex-footer border-t border-border px-4 py-5 text-center text-xs text-text-dim sm:px-6">
          <span className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span>&copy; {new Date().getFullYear()} NorthGold</span>
            <Link href="/profile" className="hover:text-text-muted">Profile &amp; KYC</Link>
            <Link href="/wallet" className="inline-flex items-center gap-1 hover:text-text-muted">
              <ArrowDownToLine size={11} /> Deposit
            </Link>
          </span>
          <p className="mx-auto mt-2 max-w-2xl leading-relaxed">
            Capital is at risk. Returns shown are the contracted schedule for each
            plan, not a guarantee of future performance.
          </p>
        </footer>
      </div>

      <SupportChat />
    </div>
  );
}
