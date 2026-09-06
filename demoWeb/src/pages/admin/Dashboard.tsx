import { Link } from 'react-router-dom';
import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Coins, Network, PiggyBank, Users,
} from 'lucide-react';

import { StatCard } from '@/components/ui';
import { money } from '@/lib/format';
import { platformStats } from '@/lib/store';

export default function AdminDashboard() {
  const s = platformStats();
  const queue = s.pending_deposits + s.pending_withdrawals;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-3d sm:text-3xl">Dashboard</h1>
        <p className="mt-1 text-sm text-text-muted">Platform-wide position and queues.</p>
      </header>

      {queue > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-warn/25 bg-warn-soft p-4 text-sm text-warn">
          <AlertTriangle size={16} className="shrink-0" />
          <span>
            <Link to="/admin/deposits" className="font-semibold underline">
              {s.pending_deposits} deposit{s.pending_deposits === 1 ? '' : 's'}
            </Link>{' '}
            ({money(s.pending_deposit_amount)}) and{' '}
            <Link to="/admin/withdrawals" className="font-semibold underline">
              {s.pending_withdrawals} withdrawal{s.pending_withdrawals === 1 ? '' : 's'}
            </Link>{' '}
            ({money(s.pending_withdrawal_amount)}) awaiting your review.
          </span>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total deposited"
          value={money(s.total_deposited)}
          hint="Approved, lifetime"
          tone="success"
          icon={<ArrowDownToLine size={17} />}
        />
        <StatCard
          label="Total withdrawn"
          value={money(s.total_withdrawn)}
          hint={`Net inflow ${money(s.total_deposited - s.total_withdrawn)}`}
          icon={<ArrowUpFromLine size={17} />}
        />
        <StatCard
          label="Active principal"
          value={money(s.active_principal)}
          hint="Currently earning returns"
          tone="accent"
          icon={<PiggyBank size={17} />}
        />
        <StatCard
          label="Members"
          value={String(s.members)}
          hint={`${s.invested_members} invested · ${s.with_sponsor} referred`}
          icon={<Users size={17} />}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="ROI paid out" value={money(s.roi_paid)} icon={<Coins size={17} />} />
        <StatCard
          label="Commission paid out"
          value={money(s.commission_paid)}
          hint={`${money(s.commission_direct)} direct · ${money(s.commission_indirect)} indirect`}
          icon={<Network size={17} />}
        />
        <StatCard
          label="Total obligations paid"
          value={money(s.roi_paid + s.commission_paid)}
          hint="ROI plus commission"
        />
        <StatCard
          label="Members with a sponsor"
          value={String(s.with_sponsor)}
          hint={`${s.members - s.with_sponsor} joined without a referral`}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Commission by level
          </h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Level</th>
                  <th className="text-right">Payments</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {s.by_level.map((row) => (
                  <tr key={row.level}>
                    <td className="font-medium">
                      L{row.level}
                      <span
                        className={`ml-2 badge ${
                          row.level === 1 ? 'bg-accent/15 text-accent' : 'bg-bronze/15 text-bronze'
                        }`}
                      >
                        {row.level === 1 ? 'direct' : 'indirect'}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{row.payments}</td>
                    <td className="text-right tabular-nums text-success">{money(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Top sponsors
          </h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="text-right">Directs</th>
                </tr>
              </thead>
              <tbody>
                {s.top_sponsors.map(({ user, directs }) => (
                  <tr key={user.id}>
                    <td>
                      <p className="font-medium">
                        {`${user.first_name} ${user.last_name}`.trim() || user.email}
                      </p>
                      <p className="text-xs text-text-muted">{user.email}</p>
                    </td>
                    <td className="text-right tabular-nums">{directs}</td>
                  </tr>
                ))}
                {s.top_sponsors.length === 0 && (
                  <tr>
                    <td colSpan={2} className="text-center text-text-muted">
                      Nobody has referred anyone yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/admin/deposits" className="btn-primary">Review deposits</Link>
        <Link to="/admin/withdrawals" className="btn-ghost">Review withdrawals</Link>
        <Link to="/admin/plans" className="btn-ghost">Edit ROI plans</Link>
        <Link to="/admin/levels" className="btn-ghost">Edit MLM levels</Link>
      </div>
    </div>
  );
}
