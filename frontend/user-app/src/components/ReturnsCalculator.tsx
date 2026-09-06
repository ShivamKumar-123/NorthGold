'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Calculator, TrendingUp } from 'lucide-react';
import Link from 'next/link';

import { ApiError, api, money, num } from '@/lib/api';
import type { Projection, RoiPlan } from '@/types';
import { Alert, Spinner } from './ui';

const PRESETS = [500, 1000, 5000, 25000];

/**
 * Shows exactly what a given amount earns, month by month.
 *
 * The schedule comes from the API rather than being recomputed here, so the
 * number a prospect sees is produced by the same code that will later pay them.
 */
export default function ReturnsCalculator({ plans }: { plans: RoiPlan[] }) {
  const [amount, setAmount] = useState('1000');
  const [planId, setPlanId] = useState('');
  const [projection, setProjection] = useState<Projection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const value = Number(amount);

  // Which slab the typed amount falls into — shown before the request fires.
  const matchedPlan = useMemo(() => {
    if (!Number.isFinite(value) || value <= 0) return null;
    return (
      [...plans]
        .filter(
          (p) =>
            value >= Number(p.min_amount) &&
            (p.max_amount === null || value <= Number(p.max_amount)),
        )
        .sort((a, b) => Number(b.min_amount) - Number(a.min_amount))[0] ?? null
    );
  }, [value, plans]);

  useEffect(() => {
    if (!Number.isFinite(value) || value <= 0) {
      setProjection(null);
      setError('');
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        setProjection(
          await api.post<Projection>(
            '/investments/projection/',
            { amount: value, plan_id: planId || undefined },
            { auth: false, signal: controller.signal },
          ),
        );
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setProjection(null);
        setError(err instanceof ApiError ? err.message : 'Could not calculate returns.');
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, planId]);

  const peak = projection
    ? projection.schedule.reduce((m, r) => Math.max(m, r.payout), 0)
    : 0;

  return (
    <div className="glass overflow-hidden rounded-3xl">
      <div className="flex items-center gap-2.5 border-b border-white/[0.07] px-6 py-4">
        <Calculator size={16} className="text-accent" />
        <h3 className="font-semibold">Returns calculator</h3>
        {loading && <Spinner className="ml-auto h-4 w-4" />}
      </div>

      <div className="grid gap-8 p-6 lg:grid-cols-[340px_1fr] lg:p-8">
        {/* ── Controls ─────────────────────────────────────────────── */}
        <div className="space-y-5">
          <div>
            <label className="label" htmlFor="calc-amount">
              How much are you investing?
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-text-dim">
                $
              </span>
              <input
                id="calc-amount"
                type="number"
                min={0}
                step={100}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input py-4 pl-9 text-2xl font-semibold tabular-nums"
                placeholder="1000"
              />
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    value === preset
                      ? 'border-accent bg-accent/12 text-accent'
                      : 'border-border text-text-muted hover:border-border-strong hover:text-text'
                  }`}
                >
                  {money(preset).replace('.00', '')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="calc-plan">
              Plan
            </label>
            <select
              id="calc-plan"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="input"
            >
              <option value="">Auto-select from amount</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} ({money(plan.min_amount)} –{' '}
                  {plan.max_amount ? money(plan.max_amount) : 'no cap'})
                </option>
              ))}
            </select>
            {!planId && matchedPlan && (
              <p className="mt-2 text-xs text-text-dim">
                {money(value)} falls in the{' '}
                <span className="font-medium text-accent">{matchedPlan.name}</span> tier.
              </p>
            )}
          </div>

          {error && <Alert kind="warn">{error}</Alert>}

          {projection && (
            <>
              <div className="rounded-2xl border border-success/25 bg-success-soft p-5">
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-success">
                  <TrendingUp size={12} /> Total return
                </p>
                <p className="mt-1.5 text-4xl font-semibold tabular-nums tracking-tight text-success">
                  {money(projection.total_return)}
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  {num(projection.total_return_percent, 2)}% over{' '}
                  {projection.tenure_months} months
                </p>
              </div>

              <dl className="space-y-2.5 text-sm">
                <Row label="Plan" value={projection.plan} />
                <Row label="Principal" value={money(projection.principal)} />
                <Row
                  label="Paid back in total"
                  value={money(
                    projection.total_return +
                      (projection.returns_principal ? projection.principal : 0),
                  )}
                  strong
                />
              </dl>

              <p className="text-xs leading-relaxed text-text-dim">
                {projection.returns_principal
                  ? 'Your principal returns to your wallet at maturity.'
                  : 'Principal is held past maturity until released by support.'}
              </p>

              <Link href="/register" className="btn-primary w-full">
                Start earning <ArrowRight size={15} />
              </Link>
            </>
          )}
        </div>

        {/* ── Schedule ─────────────────────────────────────────────── */}
        <div>
          {loading && !projection ? (
            <div className="flex h-80 items-center justify-center rounded-2xl border border-border">
              <Spinner className="h-6 w-6" />
            </div>
          ) : projection ? (
            <div className="space-y-5">
              {/* Payout curve */}
              <div className="rounded-2xl border border-border bg-bg-sunken/60 p-5">
                <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
                  Monthly payout curve
                </p>
                <div className="flex h-28 items-end gap-1.5">
                  {projection.schedule.map((row) => (
                    <div
                      key={row.month}
                      className="group relative flex-1"
                      style={{ height: '100%' }}
                    >
                      <div className="flex h-full items-end">
                        <span
                          className="w-full rounded-t bg-gradient-to-t from-accent/40 to-accent transition-all duration-300 group-hover:from-accent/60 group-hover:to-bronze"
                          style={{
                            height: `${peak > 0 ? Math.max((row.payout / peak) * 100, 6) : 6}%`,
                          }}
                        />
                      </div>
                      {/* Hover readout */}
                      <span className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-border-strong bg-bg-elevated px-2 py-1 text-[11px] opacity-0 shadow-lift transition group-hover:opacity-100">
                        M{row.month} · {money(row.payout)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-text-dim">
                  <span>Month 1</span>
                  <span>Month {projection.tenure_months}</span>
                </div>
              </div>

              {/* Full table */}
              <div className="table-wrap max-h-[300px] overflow-y-auto">
                <table className="data">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th>Month</th>
                      <th className="text-right">Rate</th>
                      <th className="text-right">Payout</th>
                      <th className="text-right">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projection.schedule.map((row) => (
                      <tr key={row.month}>
                        <td className="font-medium">Month {row.month}</td>
                        <td className="text-right tabular-nums text-gold">
                          {num(row.percent, 3)}%
                        </td>
                        <td className="text-right tabular-nums text-success">
                          {money(row.payout)}
                        </td>
                        <td className="text-right tabular-nums text-text-muted">
                          {money(row.cumulative)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex h-80 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-text-muted">
              Enter an amount to see the month-by-month schedule.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-semibold text-text' : 'text-text'}`}>
        {value}
      </dd>
    </div>
  );
}
