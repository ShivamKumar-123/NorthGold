'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, CandlestickChart, LayoutDashboard, LogOut, Menu,
  MessageCircle, Network, Settings, ShieldCheck, SlidersHorizontal, Users, Wallet, X,
} from 'lucide-react';

import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth';

const GROUPS = [
  {
    title: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Verification',
    items: [
      { href: '/deposits', label: 'Deposits', icon: ArrowDownToLine },
      { href: '/withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
      { href: '/kyc', label: 'KYC', icon: ShieldCheck },
      { href: '/messages', label: 'Messages', icon: MessageCircle },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { href: '/roi-plans', label: 'ROI plans', icon: SlidersHorizontal },
      { href: '/mlm-config', label: 'MLM levels', icon: Network },
      { href: '/instruments', label: 'Instruments', icon: CandlestickChart },
      { href: '/channels', label: 'Payment channels', icon: Wallet },
    ],
  },
  {
    title: 'People',
    items: [
      { href: '/users', label: 'Users & network', icon: Users },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { admin, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // The login screen renders bare — no chrome around it.
  if (!admin || pathname === '/login') return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <aside
        className={`tex-sidebar on-dark fixed inset-y-0 left-0 z-50 flex w-[270px] shrink-0 flex-col
                    border-r border-border transition-transform duration-300
                    lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          boxShadow: '1px 0 0 rgba(255,255,255,.04), 18px 0 50px -30px rgba(0,0,0,.9)',
        }}
      >
        <div className="flex h-[74px] shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
            <Logo className="h-10" priority />
            <span className="border-l border-border pl-2.5 text-[9px] uppercase leading-tight tracking-[0.16em] text-text-dim">
              Admin<br />panel
            </span>
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

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-text-faint">
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={`tex-navlink group relative flex items-center gap-3 overflow-hidden
                                  rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
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
                      <Icon size={16} className="shrink-0" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/20 text-sm font-semibold text-accent shadow-e1">
              {admin.name.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-text">{admin.name}</span>
              <span className="block truncate text-[11px] text-text-muted">{admin.email}</span>
            </span>
          </div>
          <span className="badge mx-2 bg-accent/12 text-accent">{admin.role}</span>
          <button
            onClick={logout}
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-danger transition hover:bg-danger/10"
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-xl lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-xl border border-border p-2 text-text-muted shadow-btn-3d-ghost hover:text-text"
            aria-label="Open navigation"
            aria-expanded={open}
          >
            <Menu size={18} />
          </button>
          <Logo variant="mark" className="h-7" />
          <span className="text-[10px] uppercase tracking-[0.16em] text-text-dim">Admin panel</span>
        </header>

        <main className="tex-app min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
