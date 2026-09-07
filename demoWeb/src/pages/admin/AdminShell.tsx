import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine, ArrowUpFromLine, LayoutDashboard, Layers, LogOut, Menu, Network,
  RotateCcw, Settings as SettingsIcon, ShieldCheck, Users, Wallet, X,
} from 'lucide-react';

import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import { useAuth } from '@/lib/auth';
import { displayName } from '@/lib/format';
import { pendingDeposits, pendingKyc, pendingWithdrawals, resetDemo, subscribe } from '@/lib/store';

const GROUPS: Array<{ title: string; items: Array<{ to: string; label: string; icon: typeof Users; badge?: 'deposits' | 'withdrawals' | 'kyc' }> }> = [
  {
    title: 'Overview',
    items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Verification',
    items: [
      { to: '/admin/deposits', label: 'Deposits', icon: ArrowDownToLine, badge: 'deposits' },
      { to: '/admin/withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine, badge: 'withdrawals' },
      { to: '/admin/kyc', label: 'KYC', icon: ShieldCheck, badge: 'kyc' },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { to: '/admin/plans', label: 'ROI plans', icon: Layers },
      { to: '/admin/levels', label: 'MLM levels', icon: Network },
      { to: '/admin/channels', label: 'Cash counter', icon: Wallet },
    ],
  },
  {
    title: 'People',
    items: [
      { to: '/admin/users', label: 'Users & network', icon: Users },
      { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];

/**
 * The admin panel's chrome.
 *
 * The rail stays dark in both themes: it is the one fixed anchor in the panel,
 * and an ivory sidebar against ivory content leaves the layout with no
 * structure at all.
 */
export default function AdminShell() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => subscribe(() => tick((n) => n + 1)), []);

  useEffect(() => {
    if (loading) return;
    // Staff only. A signed-in member who lands here is sent back to their own
    // dashboard rather than shown an empty panel.
    if (!user) navigate('/admin/login', { replace: true });
    else if (!user.is_staff) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  if (loading || !user?.is_staff) return null;

  const counts = {
    deposits: pendingDeposits().length,
    withdrawals: pendingWithdrawals().length,
    kyc: pendingKyc().length,
  };

  return (
    <div className="flex min-h-screen">
      <aside
        className={`tex-sidebar on-dark fixed inset-y-0 left-0 z-50 flex w-[270px] shrink-0 flex-col
                    border-r border-border transition-transform duration-300
                    lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ boxShadow: '1px 0 0 rgba(255,255,255,.04), 18px 0 50px -30px rgba(0,0,0,.9)' }}
      >
        <div className="flex h-[74px] shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <Link to="/admin" className="flex min-w-0 items-center gap-2.5">
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
                {group.items.map(({ to, label, icon: Icon, badge }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === '/admin'}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `tex-navlink group relative flex items-center gap-3 overflow-hidden rounded-xl
                       px-3 py-2.5 text-sm transition-all duration-200 ${
                         isActive
                           ? 'tex-navlink-active font-medium text-accent'
                           : 'text-text-muted hover:translate-x-0.5 hover:text-text'
                       }`
                    }
                  >
                    <Icon size={16} className="shrink-0" />
                    {label}
                    {badge && counts[badge] > 0 && (
                      <span className="ml-auto rounded-full bg-warn/20 px-2 py-0.5 text-[10px] font-semibold text-warn">
                        {counts[badge]}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/20 text-sm font-semibold text-accent shadow-e1">
              {displayName(user).charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-text">{displayName(user)}</span>
              <span className="block truncate text-[11px] text-text-dim">{user.email}</span>
            </span>
          </div>

          <button
            onClick={() => {
              // Destructive and irreversible, so it asks first — the whole
              // demo database goes back to the seed.
              if (window.confirm('Reset the demo database back to its seeded state?')) {
                resetDemo();
                navigate('/admin', { replace: true });
              }
            }}
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm
                       text-text-muted transition hover:bg-white/[0.045] hover:text-text"
          >
            <RotateCcw size={16} /> Reset demo data
          </button>

          <button
            onClick={() => {
              logout();
              navigate('/admin/login', { replace: true });
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[74px] items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-xl lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-xl border border-border p-2 text-text-muted shadow-btn-3d-ghost hover:text-text"
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
          <Logo variant="mark" className="h-10" />
          <span className="text-[10px] uppercase tracking-[0.16em] text-text-dim">Admin panel</span>
        </header>

        <main className="tex-app min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
