'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { PiggyBank, Plus } from 'lucide-react';

import { Alert, EmptyState, Modal, PageLoader, StatCard, StatusBadge } from '@/components/ui';
import { ApiError, api, money, num, shortDate } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/lib/auth';
import type { Investment, InvestmentSummary, Paginated, RoiPlan } from '@/types';

export default function InvestmentsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { refreshUser } = useAuth();

  const [summary, setSummary] = useState<InvestmentSummary | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [plans, setPlans] = useState<RoiPlan[]>([]);
  const [expanded, setExpanded] = useState<Investment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, list, planList] = await Promise.all([
        api.get<InvestmentSummary>('/investments/summary/'),
        api.get<Paginated<Investment>>('/investments/?per_page=50'),
        api.get<RoiPlan[]>('/investments/plans/', { auth: false }),
      ]);
      setSummary(s);
      setInvestments(list.items);
      setPlans(planList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your investments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function openDetail(investment: Investment) {
    try {
      setExpanded(await api.get<Investment>(`/investments/${investment.id}/`));
    } catch {
      setExpanded(investment);
    }
  }

  if (authLoading || (loading && !summary)) return <PageLoader label="Loading your investments" />;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Investments</h1>
          <p className="mt-1 text-sm text-text-muted">
            Each investment pays a different percentage every month of its term.
          </p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary">
          <Plus size={15} /> New investment
        </button>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-5"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active principal" value={money(summary?.active_principal)} tone="accent" />
        <StatCard label="Active investments" value={num(summary?.active_count ?? 0, 0)} />
        <StatCard label="Returns received" value={money(summary?.total_roi_received)} tone="success" />
        <StatCard label="Matured" value={num(summary?.matured_count ?? 0, 0)} />
      </div>

      <div className="mt-8">
        {investments.length === 0 ? (
          <EmptyState
            title="No investments yet"
            description="Deposit funds, then put them into a plan to start earning a monthly return."
            icon={<PiggyBank size={26} />}
            action={<Link href="/wallet" className="btn-primary">Deposit funds</Link>}
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th className="text-right">Principal</th>
                  <th>Started</th>
                  <th>Matures</th>
                  <th>Progress</th>
                  <th className="text-right">Returned</th>
                  <th>Next payout</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {investments.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => openDetail(inv)}
                    className="cursor-pointer"
                  >
                    <td>
                      <p className="font-medium">{inv.plan_name}</p>
                      {inv.instrument_name && (
                        <p className="text-xs text-text-muted">{inv.instrument_name}</p>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{money(inv.principal)}</td>
                    <td className="text-text-muted">{shortDate(inv.start_date)}</td>
                    <td className="text-text-muted">{shortDate(inv.maturity_date)}</td>
                    <td className="text-text-muted tabular-nums">
                      {inv.months_paid}/{inv.tenure_months}
                    </td>
                    <td className="text-right tabular-nums text-success">{money(inv.total_roi_paid)}</td>
                    <td className="text-text-muted">
                      {inv.next_payout ? (
                        <>
                          <span className="tabular-nums text-gold">{num(inv.next_payout.percent, 2)}%</span>
                          <span className="ml-1.5 text-xs">{shortDate(inv.next_payout.due_at)}</span>
                        </>
                      ) : '—'}
                    </td>
                    <td><StatusBadge status={inv.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateInvestmentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        plans={plans}
        available={summary?.wallet_balance ?? 0}
        onDone={async (msg) => {
          setNotice(msg);
          setCreateOpen(false);
          await Promise.all([load(), refreshUser()]);
        }}
      />

      <Modal
        open={Boolean(expanded)}
        title={expanded ? `${expanded.plan_name} — ${money(expanded.principal)}` : ''}
        onClose={() => setExpanded(null)}
        width="max-w-3xl"
      >
        {expanded && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Mini label="Principal" value={money(expanded.principal)} />
              <Mini label="Returned" value={money(expanded.total_roi_paid)} tone="text-success" />
              <Mini label="Term" value={`${expanded.tenure_months} months`} />
              <Mini label="Matures" value={shortDate(expanded.maturity_date)} />
            </div>

            <div className="table-wrap max-h-[380px] overflow-y-auto">
              <table className="data">
                <thead className="sticky top-0">
                  <tr>
                    <th>Month</th>
                    <th>Due</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(expanded.payouts ?? []).length === 0 ? (
                    <tr><td colSpan={5} className="py-6 text-center text-text-muted">
                      No payouts yet — the first is due one month after the start date.
                    </td></tr>
                  ) : (
                    [...(expanded.payouts ?? [])]
                      .sort((a, b) => a.month_index - b.month_index)
                      .map((p) => (
                        <tr key={p.id}>
                          <td className="font-medium">Month {p.month_index}</td>
                          <td className="text-text-muted">{shortDate(p.due_at)}</td>
                          <td className="text-right tabular-nums text-gold">{num(p.percent, 3)}%</td>
                          <td className="text-right tabular-nums text-success">{money(p.amount)}</td>
                          <td><StatusBadge status={p.status} /></td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {expanded.next_payout && (
              <Alert kind="info">
                Next payout: month {expanded.next_payout.month_index} at{' '}
                {num(expanded.next_payout.percent, 2)}% —{' '}
                <strong>{money(expanded.next_payout.estimated_amount)}</strong> due{' '}
                {shortDate(expanded.next_payout.due_at)}.
              </Alert>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Mini({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-3">
      <p className="text-[10px] uppercase tracking-wide text-text-dim">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function CreateInvestmentModal({
  open,
  onClose,
  plans,
  available,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  plans: RoiPlan[];
  available: number;
  onDone: (message: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [planId, setPlanId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const value = Number(amount);
  const matched = Number.isFinite(value) && value > 0
    ? [...plans]
        .filter((p) => value >= Number(p.min_amount) && (p.max_amount === null || value <= Number(p.max_amount)))
        .sort((a, b) => Number(b.min_amount) - Number(a.min_amount))[0]
    : undefined;
  const chosen = planId ? plans.find((p) => p.id === planId) : matched;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (value > available) {
      setError(`You only have ${money(available)} available. Deposit more first.`);
      return;
    }
    setSubmitting(true);
    try {
      await api.post<Investment>('/investments/', { amount, plan_id: planId || undefined });
      setAmount('');
      setPlanId('');
      onDone('Investment created. Your first return is due in one month.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the investment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title="New investment" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert kind="error">{error}</Alert>}

        <Alert kind="info">
          Available in your wallet: <strong>{money(available)}</strong>
        </Alert>

        <div>
          <label className="label" htmlFor="inv-amount">Amount <span className="text-danger">*</span></label>
          <input
            id="inv-amount"
            type="number"
            min={1}
            max={available}
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            placeholder="1000.00"
          />
        </div>

        <div>
          <label className="label" htmlFor="inv-plan">Plan</label>
          <select id="inv-plan" value={planId} onChange={(e) => setPlanId(e.target.value)} className="input">
            <option value="">Auto-select from amount</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({money(p.min_amount)} – {p.max_amount ? money(p.max_amount) : 'no cap'})
              </option>
            ))}
          </select>
        </div>

        {chosen && (
          <div className="rounded-lg border border-border bg-bg-elevated p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">{chosen.name}</p>
              <p className="tabular-nums text-gold">{num(chosen.total_return_percent, 2)}% total</p>
            </div>
            <div className="mt-3 grid grid-cols-6 gap-1.5 text-center text-[10px]">
              {chosen.months.map((m) => (
                <div key={m.month_index} className="rounded bg-bg p-1.5">
                  <p className="text-text-dim">M{m.month_index}</p>
                  <p className="tabular-nums text-success">{num(m.percent, 2)}%</p>
                </div>
              ))}
            </div>
            {value > 0 && (
              <p className="mt-3 border-t border-border pt-2.5 text-sm text-text-muted">
                {money(value)} would return{' '}
                <strong className="text-success">
                  {money((value * Number(chosen.total_return_percent)) / 100)}
                </strong>{' '}
                over {chosen.tenure_months} months.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Creating…' : 'Start investment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
