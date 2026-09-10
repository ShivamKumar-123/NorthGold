'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Check, Copy, GitBranch, Layers, List, Network, Share2, TrendingUp, Users,
} from 'lucide-react';

import NetworkGraph from '@/components/NetworkGraph';
import NetworkTree from '@/components/NetworkTree';
import { Alert, EmptyState, PageLoader, StatCard, StatusBadge } from '@/components/ui';
import { ApiError, api, dateTime, money, num } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import type { Commission, EarningsResponse, Paginated, TreeResponse } from '@/types';

type Tab = 'tree' | 'levels' | 'commissions';
// The graph shows the shape of the network; the list is what you scan when
// you actually need to read every member's numbers.
type TreeView = 'graph' | 'list';

export default function ReferralsPage() {
  const { user, loading: authLoading } = useRequireAuth();

  const [earnings, setEarnings] = useState<EarningsResponse | null>(null);
  const [tree, setTree] = useState<TreeResponse | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [tab, setTab] = useState<Tab>('tree');
  const [treeView, setTreeView] = useState<TreeView>('graph');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [earningsRes, treeRes, commissionRes] = await Promise.all([
        api.get<EarningsResponse>('/mlm/earnings/'),
        api.get<TreeResponse>('/auth/tree/?depth=10'),
        api.get<Paginated<Commission>>('/mlm/commissions/?per_page=100'),
      ]);
      setEarnings(earningsRes);
      setTree(treeRes);
      setCommissions(commissionRes.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your network.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const referralLink =
    typeof window !== 'undefined' && user
      ? `${window.location.origin}/register?ref=${user.referral_code}`
      : '';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select the link and copy it manually.');
    }
  }

  if (authLoading || (loading && !earnings)) return <PageLoader label="Loading your business" />;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold">My business</h1>
        <p className="mt-1 text-sm text-text-muted">
          Everyone below you, what they have invested, and what they have paid you.
        </p>
      </header>

      {error && (
        <div className="mt-5">
          <Alert kind="error" onDismiss={() => setError('')}>{error}</Alert>
        </div>
      )}

      {/* Referral link */}
      <div className="mt-6 card p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Share2 size={16} className="text-accent" />
          Your referral link
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input readOnly value={referralLink} className="input flex-1 font-mono text-xs" />
          <button onClick={copyLink} className={copied ? 'btn-ghost text-success' : 'btn-primary'}>
            {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy link</>}
          </button>
        </div>
        <p className="mt-2 text-xs text-text-dim">
          Your code is <span className="font-mono text-accent">{user.referral_code}</span>. Anyone
          who registers with this link joins at level 1 of your network.
        </p>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total earned"
          value={money(earnings?.total_earned)}
          tone="success"
          icon={<TrendingUp size={17} />}
        />
        <StatCard
          label="Referrals paying you"
          value={String(earnings?.paying_referrals ?? 0)}
          hint="People whose deposits are earning you a monthly share"
          icon={<Users size={17} />}
        />
        <StatCard
          label="Months paid"
          value={String(
            (earnings?.by_referral ?? []).reduce((sum, r) => sum + r.months, 0),
          )}
          hint="One payment per referral, per month their deposit runs"
          tone="gold"
          icon={<Layers size={17} />}
        />
        <StatCard
          label="Network size"
          value={num(earnings?.network.total_downline ?? 0, 0)}
          hint={`${earnings?.network.direct_count ?? 0} direct · ${money(
            earnings?.network.team_business,
          )} team business`}
          icon={<Network size={17} />}
        />
      </div>

      {/* Tabs */}
      <div className="mt-8 flex gap-1 border-b border-border">
        {([
          ['tree', `Tree (${tree?.total_nodes ?? 0})`],
          ['levels', 'Level breakdown'],
          ['commissions', `Commissions (${commissions.length})`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition ${
              tab === key
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'tree' && (
          <div className="space-y-4">
            {(tree?.tree?.length ?? 0) > 0 && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-text-muted">
                  {tree?.total_nodes ?? 0} member{(tree?.total_nodes ?? 0) === 1 ? '' : 's'} across{' '}
                  {Object.keys(tree?.levels ?? {}).length} level
                  {Object.keys(tree?.levels ?? {}).length === 1 ? '' : 's'}
                </p>
                <div className="flex gap-1 rounded-xl border border-border bg-white/[0.02] p-1">
                  {([
                    ['graph', 'Graph', <GitBranch key="g" size={14} />],
                    ['list', 'List', <List key="l" size={14} />],
                  ] as [TreeView, string, React.ReactNode][]).map(([key, label, icon]) => (
                    <button
                      key={key}
                      onClick={() => setTreeView(key)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition ${
                        treeView === key
                          ? 'bg-accent/15 font-medium text-accent shadow-e1'
                          : 'text-text-muted hover:text-text'
                      }`}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {treeView === 'graph' ? (
              <NetworkGraph
                nodes={tree?.tree ?? []}
                rootName={user.first_name || user.name}
              />
            ) : (
              <NetworkTree nodes={tree?.tree ?? []} />
            )}
          </div>
        )}

        {tab === 'levels' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
                Your network by level
              </h2>
              {earnings?.network.levels.length ? (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Level</th>
                        <th className="text-right">Members</th>
                        <th className="text-right">Business</th>
                        <th className="text-right">Active principal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {earnings.network.levels.map((row) => (
                        <tr key={row.level}>
                          <td className="font-medium">
                            Level {row.level}
                            {row.level === 1 && (
                              <span className="ml-2 badge bg-accent/15 text-accent">direct</span>
                            )}
                          </td>
                          <td className="text-right tabular-nums">{row.count}</td>
                          <td className="text-right tabular-nums">{money(row.business)}</td>
                          <td className="text-right tabular-nums text-text-muted">
                            {money(row.invested)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No downline yet" description="Share your link to start building." />
              )}
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
                What each level pays
              </h2>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>If they deposit</th>
                      <th className="text-right">You earn each month</th>
                      <th className="text-right">Over the term</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(earnings?.structure ?? []).map((plan) => {
                      // A flat slab shows one figure; a ramped one shows its
                      // span, because quoting only month one would understate
                      // what the slab actually pays.
                      const rates = plan.months.map((m) => Number(m.percent));
                      const low = rates.length ? Math.min(...rates) : 0;
                      const high = rates.length ? Math.max(...rates) : 0;
                      return (
                        <tr key={plan.id}>
                          <td className="font-medium">
                            {money(plan.min_amount)}
                            {plan.max_amount === null ? '+' : ` – ${money(plan.max_amount)}`}
                          </td>
                          <td className="text-right tabular-nums text-gold">
                            {low === high
                              ? `${num(low, 2)}%`
                              : `${num(low, 2)}–${num(high, 2)}%`}
                          </td>
                          <td className="text-right tabular-nums text-success">
                            {num(plan.total_percent, 2)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {earnings?.top_producing_members.length ? (
                <>
                  <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-text-muted">
                    Top producers in your network
                  </h2>
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Member</th>
                          <th className="text-right">Paid you</th>
                        </tr>
                      </thead>
                      <tbody>
                        {earnings.top_producing_members.map((m) => (
                          <tr key={m.user_id}>
                            <td>
                              <p className="font-medium">{m.name}</p>
                              <p className="text-xs text-text-muted">{m.email}</p>
                            </td>
                            <td className="text-right tabular-nums text-success">{money(m.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </section>
          </div>
        )}

        {tab === 'commissions' && (
          commissions.length === 0 ? (
            <EmptyState
              title="No commission yet"
              description="You earn when someone in your network deposits, and again every month they receive a return."
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>From</th>
                    <th>Level</th>
                    <th>Event</th>
                    <th className="text-right">Base</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">You earned</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id}>
                      <td className="text-text-muted">{dateTime(c.created_at)}</td>
                      <td>
                        <p className="font-medium">{c.source_name}</p>
                        <p className="text-xs text-text-muted">{c.source_email}</p>
                      </td>
                      <td>
                        <span className="badge bg-accent/15 text-accent">
                          Month {c.month_index}
                        </span>
                      </td>
                      <td className="text-right tabular-nums text-text-muted">{money(c.base_amount)}</td>
                      <td className="text-right tabular-nums">{num(c.percent, 2)}%</td>
                      <td className="text-right tabular-nums font-medium text-success">
                        {money(c.amount)}
                      </td>
                      <td>
                        <StatusBadge status={c.status} />
                        {c.status === 'skipped' && c.skip_reason && (
                          <p className="mt-1 max-w-[200px] whitespace-normal text-xs text-text-dim">
                            {c.skip_reason}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
}
