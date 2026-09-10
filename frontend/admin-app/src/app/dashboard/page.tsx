'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Coins, Network, PiggyBank, Users,
} from 'lucide-react';

import { Alert, PageLoader, StatCard } from '@/components/ui';
import { ApiError, api, money, num } from '@/lib/api';
import { useRequireAdmin } from '@/lib/auth';

type WalletStats = {
  pending_deposits: { count: number; amount: string | null };
  pending_withdrawals: { count: number; amount: string | null };
  total_deposited: number;
  total_withdrawn: number;
  active_principal: number;
  total_roi_paid: number;
  total_commission_paid: number;
  users: { total: number; active: number; with_investments: number };
};

type NetworkStats = {
  total_commission_paid: number;
  payments_made: number;
  skipped_count: number;
  by_month: { month_index: number; total: number; count: number }[];
  by_trigger: Record<string, number>;
  users_with_sponsor: number;
  users_without_sponsor: number;
  top_sponsors: {
    user_id: string;
    email: string;
    name: string;
    total_earned: number;
    direct_referrals: number;
  }[];
};

export default function AdminDashboard() {
  const { admin, loading: authLoading } = useRequireAdmin();

  const [wallet, setWallet] = useState<WalletStats | null>(null);
  const [network, setNetwork] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, n] = await Promise.all([
        api.get<WalletStats>('/wallet/admin/stats/'),
        api.get<NetworkStats>('/mlm/admin/overview/'),
      ]);
      setWallet(w);
      setNetwork(n);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load platform statistics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) void load();
  }, [admin, load]);

  if (authLoading || (loading && !wallet)) return <PageLoader label="Loading dashboard" />;
  if (!admin) return null;

  const pendingDeposits = wallet?.pending_deposits.count ?? 0;
  const pendingWithdrawals = wallet?.pending_withdrawals.count ?? 0;
  // What the platform holds versus what it has paid out — the number that says
  // whether the book is solvent at a glance.
  const netFlow = (wallet?.total_deposited ?? 0) - (wallet?.total_withdrawn ?? 0);
  const totalPaidOut = (wallet?.total_roi_paid ?? 0) + (wallet?.total_commission_paid ?? 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">Platform-wide position and queues.</p>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}

      {(pendingDeposits > 0 || pendingWithdrawals > 0) && (
        <div className="mt-5">
          <Alert kind="warn">
            <span className="flex flex-wrap items-center gap-x-2">
              <AlertTriangle size={14} />
              {pendingDeposits > 0 && (
                <>
                  <Link href="/deposits" className="underline">
                    {pendingDeposits} deposit{pendingDeposits === 1 ? '' : 's'}
                  </Link>{' '}
                  ({money(wallet?.pending_deposits.amount)})
                </>
              )}
              {pendingDeposits > 0 && pendingWithdrawals > 0 && ' and '}
              {pendingWithdrawals > 0 && (
                <>
                  <Link href="/withdrawals" className="underline">
                    {pendingWithdrawals} withdrawal{pendingWithdrawals === 1 ? '' : 's'}
                  </Link>{' '}
                  ({money(wallet?.pending_withdrawals.amount)})
                </>
              )}
              {' '}awaiting your review.
            </span>
          </Alert>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total deposited"
          value={money(wallet?.total_deposited)}
          hint="Approved, lifetime"
          tone="success"
          icon={<ArrowDownToLine size={17} />}
        />
        <StatCard
          label="Total withdrawn"
          value={money(wallet?.total_withdrawn)}
          hint={`Net inflow ${money(netFlow)}`}
          icon={<ArrowUpFromLine size={17} />}
        />
        <StatCard
          label="Active principal"
          value={money(wallet?.active_principal)}
          hint="Currently earning returns"
          tone="accent"
          icon={<PiggyBank size={17} />}
        />
        <StatCard
          label="Members"
          value={num(wallet?.users.total ?? 0, 0)}
          hint={`${wallet?.users.active ?? 0} active · ${wallet?.users.with_investments ?? 0} invested`}
          icon={<Users size={17} />}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="ROI paid out"
          value={money(wallet?.total_roi_paid)}
          tone="gold"
          icon={<Coins size={17} />}
        />
        <StatCard
          label="Commission paid out"
          value={money(wallet?.total_commission_paid)}
          hint={`${network?.payments_made ?? 0} monthly payments`}
          tone="gold"
          icon={<Network size={17} />}
        />
        <StatCard
          label="Total obligations paid"
          value={money(totalPaidOut)}
          hint="ROI plus commission"
        />
        <StatCard
          label="Members with a sponsor"
          value={num(network?.users_with_sponsor ?? 0, 0)}
          hint={`${network?.users_without_sponsor ?? 0} joined without a referral`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Commission by month of term
          </h2>
          {network?.by_month.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="text-right">Payments</th>
                    <th className="text-right">Total paid</th>
                  </tr>
                </thead>
                <tbody>
                  {network.by_month.map((row) => (
                    <tr key={row.month_index}>
                      <td className="font-medium">Month {row.month_index}</td>
                      <td className="text-right tabular-nums">{row.count}</td>
                      <td className="text-right tabular-nums text-success">{money(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-text-muted">
              No commission paid yet.
            </p>
          )}

          {network && network.skipped_count > 0 && (
            <p className="mt-3 text-xs text-text-muted">
              {network.skipped_count} commission event(s) were skipped because the
              upline had not met that level&apos;s qualification — see{' '}
              <Link href="/referral-rates" className="text-accent underline">Referral rates</Link>.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Top sponsors
          </h2>
          {network?.top_sponsors.length ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th className="text-right">Directs</th>
                    <th className="text-right">Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {network.top_sponsors.slice(0, 10).map((s) => (
                    <tr key={s.user_id}>
                      <td>
                        <Link href={`/users/${s.user_id}`} className="font-medium text-accent hover:underline">
                          {s.name.trim() || s.email}
                        </Link>
                        <p className="text-xs text-text-muted">{s.email}</p>
                      </td>
                      <td className="text-right tabular-nums">{s.direct_referrals}</td>
                      <td className="text-right tabular-nums text-success">{money(s.total_earned)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-text-muted">
              No sponsors have earned yet.
            </p>
          )}
        </section>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/deposits" className="btn-primary">Review deposits</Link>
        <Link href="/withdrawals" className="btn-ghost">Review withdrawals</Link>
        <Link href="/roi-plans" className="btn-ghost">Edit ROI plans</Link>
        <Link href="/referral-rates" className="btn-ghost">Edit referral rates</Link>
      </div>
    </div>
  );
}
