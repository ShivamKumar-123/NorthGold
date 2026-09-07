import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CalendarClock, Coins, Network, PiggyBank, ShieldCheck, TrendingUp, Users, Wallet,
} from 'lucide-react';

import NetworkGraph from '@/components/NetworkGraph';
import { EmptyState, PageLoader, StatCard, StatusBadge } from '@/components/ui';
import { useRequireAuth } from '@/lib/auth';
import { money, num, shortDate } from '@/lib/format';
import * as q from '@/lib/queries';
import { KYC_DOC_TYPES, kycFor, subscribe } from '@/lib/store';

export default function DashboardPage() {
  const { user, loading: authLoading } = useRequireAuth();
  // The store is synchronous, so there is no request to await — but writes
  // from anywhere (approving a deposit in another tab, a payout falling due)
  // still have to reach this screen, which is what the subscription is for.
  const [, tick] = useState(0);
  useEffect(() => subscribe(() => tick((n) => n + 1)), []);

  if (authLoading) return <PageLoader label="Loading your dashboard" />;
  if (!user) return null;

  const wallet = q.walletSummary(user.id);
  const investments = q.investmentSummary(user.id);
  const earnings = q.earnings(user.id);
  const active = q.investments(user.id).filter((i) => i.status === 'active').slice(0, 5);
  const recent = q.transactions(user.id, 8);
  const treeNodes = q.tree(user.id, 2);

  const kycDocs = kycFor(user.id);
  const kycApproved = user.kyc_status === 'approved';
  const kycRejected = kycDocs.some((d) => d.status === 'rejected');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* `on-dark`: the plate is a photograph in both themes, so the copy on
          top of it stays light regardless of the active theme. */}
      <header className="on-dark relative isolate overflow-hidden rounded-3xl border border-border shadow-e2">
        {/* The plate is a tall portrait shot; anchored right so the sunrise and
            peaks land beside the copy instead of behind it. */}
          <img
          src="/images/dash/header.webp"
          alt=""
          width={1400}
          height={1650}
          loading="eager"
          decoding="async"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[75%_38%]"
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(100deg, rgba(8,8,8,.95) 0%, rgba(8,8,8,.86) 42%, rgba(8,8,8,.35) 100%)',
          }}
          aria-hidden
        />
        <div className="px-6 py-8 sm:px-8 sm:py-10">
          <h1 className="text-2xl font-semibold text-text text-3d sm:text-3xl">
            Welcome back, {user.first_name || user.email}
          </h1>
          <p className="mt-1.5 text-sm text-text-muted">
            Here is where your money and your network stand today.
          </p>
          <p className="mt-5 max-w-xs border-l-2 border-accent/60 pl-3 text-xs italic leading-relaxed text-text-muted">
            Small steps today, bigger tomorrows.
          </p>
        </div>
      </header>

      
      {/* Identity verification, always on show — not only while something is
          wrong. Someone who has just uploaded five documents wants to watch
          them clear, and hiding the panel the moment they are approved leaves
          no way to check what the desk actually holds. */}
      <section className="card mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheck size={17} className="text-accent" /> Identity verification
          </h2>
          <StatusBadge status={user.kyc_status} />
        </div>

        <p className="mt-1.5 text-sm text-text-muted">
          {kycApproved
            ? 'All your documents have been approved. Nothing further is needed.'
            : kycRejected
              ? 'One or more documents were not accepted. Re-upload them from your profile.'
              : 'Your documents are with our verification desk. Each one is reviewed separately.'}
        </p>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {KYC_DOC_TYPES.map((type) => {
            const doc = kycDocs.find((d) => d.doc_type === type.value);
            return (
              <li
                key={type.value}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-card/50 px-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{type.label}</span>
                  {doc?.rejection_reason && (
                    <span className="block truncate text-xs text-danger">{doc.rejection_reason}</span>
                  )}
                </span>
                {doc ? (
                  <StatusBadge status={doc.status} />
                ) : (
                  <span className="text-xs text-text-dim">Not uploaded</span>
                )}
              </li>
            );
          })}
        </ul>

        {!kycApproved && (
          <Link
            to="/kyc"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Manage documents <ArrowRight size={14} />
          </Link>
        )}
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Available balance"
          value={money(wallet.wallet_balance)}
          tone="success"
          icon={<Wallet size={17} />}
        />
        <StatCard
          label="Active principal"
          value={money(investments.active_principal)}
          hint={`${investments.active_count} active ${
            investments.active_count === 1 ? 'investment' : 'investments'
          }`}
          tone="accent"
          icon={<PiggyBank size={17} />}
        />
        <StatCard
          label="Returns received"
          value={money(investments.total_roi_received)}
          hint="Lifetime monthly returns"
          tone="gold"
          icon={<TrendingUp size={17} />}
        />
        <StatCard
          label="Referral earnings"
          value={money(earnings.total_earned)}
          hint={`${earnings.network.total_downline} in your network`}
          icon={<Users size={17} />}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Upcoming payouts */}
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
              <CalendarClock size={15} /> Upcoming payouts
            </h2>
            <Link to="/investments" className="text-xs text-accent hover:underline">
              All investments <ArrowRight size={12} className="inline" />
            </Link>
          </div>

          {investments.upcoming_payouts.length ? (
            <div className="table-wrap tex-chart">
              <table className="data">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Month</th>
                    <th>Due</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Estimated</th>
                  </tr>
                </thead>
                <tbody>
                  {investments.upcoming_payouts.map((p) => (
                    <tr key={`${p.investment_id}-${p.month_index}`}>
                      <td className="font-medium">{p.plan_name}</td>
                      <td className="text-text-muted">Month {p.month_index}</td>
                      <td className="text-text-muted">{shortDate(p.due_at)}</td>
                      <td className="text-right tabular-nums text-gold">{num(p.percent, 2)}%</td>
                      <td className="text-right font-medium tabular-nums text-success">
                        {money(p.estimated_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No payouts scheduled"
              description="Deposit and invest to start receiving a return every month."
              icon={<Coins size={26} />}
              action={<Link to="/wallet" className="btn-primary">Make a deposit</Link>}
            />
          )}

          {/* Active investments */}
          {active.length > 0 && (
            <>
              <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-text-muted">
                Active investments
              </h2>
              <div className="space-y-3">
                {active.map((inv) => {
                  const progress = inv.tenure_months
                    ? Math.round((inv.months_paid / inv.tenure_months) * 100)
                    : 0;
                  return (
                    <div key={inv.id} className="card tex-activity p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{inv.plan_name}</p>
                          <p className="text-xs text-text-muted">
                            {money(inv.principal)} · started {shortDate(inv.start_date)} · matures{' '}
                            {shortDate(inv.maturity_date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums text-success">
                            {money(inv.total_roi_paid)}
                          </p>
                          <p className="text-xs text-text-dim">returned so far</p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-text-muted">
                          <span>{inv.months_paid} of {inv.tenure_months} months</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Network at a glance */}
          {treeNodes.length > 0 && (
            <>
              <div className="mb-3 mt-8 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
                  <Network size={15} /> Your network
                </h2>
                <Link to="/referrals" className="text-xs text-accent hover:underline">
                  Full tree <ArrowRight size={12} className="inline" />
                </Link>
              </div>
              <NetworkGraph
                nodes={treeNodes}
                levels={earnings.structure}
                rootName={user.first_name || user.email}
                maxDepth={2}
              />
            </>
          )}
        </section>

        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="card tex-right p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              Your network
            </h2>
            <div className="mt-3 space-y-2.5 text-sm">
              <Row label="Direct referrals" value={String(earnings.network.direct_count)} />
              <Row label="Total downline" value={String(earnings.network.total_downline)} />
              <Row label="Team business" value={money(earnings.network.team_business)} />
              <Row label="From direct" value={money(earnings.direct_earned)} valueClass="text-success" />
              <Row label="From indirect" value={money(earnings.indirect_earned)} valueClass="text-gold" />
            </div>
            <Link to="/referrals" className="btn-ghost mt-4 w-full">
              View network tree <ArrowRight size={14} />
            </Link>
          </div>

          <div className="card tex-right p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
              Recent activity
            </h2>
            {recent.length ? (
              <ul className="mt-3 divide-y divide-border text-sm">
                {recent.map((t) => {
                  const value = Number(t.amount);
                  return (
                    <li key={t.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs text-text">{t.tx_type_label}</p>
                        <p className="truncate text-xs text-text-dim">{shortDate(t.created_at)}</p>
                      </div>
                      <span
                        className={`shrink-0 tabular-nums ${value >= 0 ? 'text-success' : 'text-danger'}`}
                      >
                        {value >= 0 ? '+' : ''}{money(t.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-text-muted">Nothing yet.</p>
            )}
            <Link to="/wallet" className="btn-ghost mt-4 w-full">
              Open wallet <ArrowRight size={14} />
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-text-muted">{label}</span>
      <span className={`tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}
