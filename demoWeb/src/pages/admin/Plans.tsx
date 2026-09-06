import { useState } from 'react';
import { Save } from 'lucide-react';

import { Alert } from '@/components/ui';
import { money, num } from '@/lib/format';
import { getPlans, savePlan } from '@/lib/store';
import { totalReturnPercent, type RoiPlan } from '@/lib/types';

/**
 * The ROI plan matrix.
 *
 * Editing a plan changes what FUTURE investments are promised, never an
 * existing one: every investment copies the schedule at purchase, so the rows
 * below can be rewritten without touching anyone's contracted return. That is
 * the single most important thing to understand on this screen, so it is
 * stated on it rather than buried in a doc.
 */
export default function AdminPlans() {
  const [plans, setPlans] = useState<RoiPlan[]>(() => getPlans());
  const [message, setMessage] = useState('');

  function edit(id: string, patch: Partial<RoiPlan>) {
    setPlans((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function editMonth(id: string, index: number, value: string) {
    const percent = Number(value);
    setPlans((list) =>
      list.map((p) =>
        p.id === id
          ? { ...p, months: p.months.map((m, i) => (i === index ? (Number.isFinite(percent) ? percent : m) : m)) }
          : p,
      ),
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-3d sm:text-3xl">ROI plans</h1>
        <p className="mt-1 text-sm text-text-muted">
          Deposit slabs and the percentage each pays in each month of its term.
        </p>
      </header>

      <div className="mt-5 space-y-3">
        <Alert kind="info">
          Every investment freezes its schedule at purchase. Editing a plan here
          affects new investments only — nobody's contracted return changes.
        </Alert>
        {message && <Alert kind="success" onDismiss={() => setMessage('')}>{message}</Alert>}
      </div>

      <div className="mt-6 space-y-5">
        {plans.map((plan) => (
          <div key={plan.id} className="card p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{plan.name}</h2>
                <p className="mt-0.5 text-xs text-text-muted">{plan.description}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.12em] text-text-dim">Total over term</p>
                <p className="text-2xl font-semibold tabular-nums text-gradient-gold">
                  {num(totalReturnPercent(plan), 2)}%
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="label">Minimum deposit</span>
                <input
                  type="number"
                  min={0}
                  value={plan.min_amount}
                  onChange={(e) => edit(plan.id, { min_amount: Number(e.target.value) })}
                  className="input"
                />
              </label>
              <label className="block">
                <span className="label">Maximum deposit</span>
                <input
                  type="number"
                  min={0}
                  value={plan.max_amount ?? ''}
                  placeholder="No cap"
                  onChange={(e) =>
                    edit(plan.id, { max_amount: e.target.value === '' ? null : Number(e.target.value) })
                  }
                  className="input"
                />
              </label>
              <label className="block">
                <span className="label">Tenure (months)</span>
                <input
                  type="number"
                  min={1}
                  max={36}
                  value={plan.tenure_months}
                  onChange={(e) => {
                    const months = Math.max(1, Math.min(36, Number(e.target.value) || 1));
                    // The curve has to keep exactly one entry per month, or a
                    // payout will read `undefined` and silently pay nothing.
                    const next = [...plan.months];
                    while (next.length < months) next.push(next[next.length - 1] ?? 1);
                    next.length = months;
                    edit(plan.id, { tenure_months: months, months: next });
                  }}
                  className="input"
                />
              </label>
            </div>

            <p className="label mt-5">Monthly percentages</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-12">
              {plan.months.map((percent, i) => (
                <label key={i} className="block">
                  <span className="block text-center text-[10px] text-text-dim">M{i + 1}</span>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={percent}
                    onChange={(e) => editMonth(plan.id, i, e.target.value)}
                    className="input mt-1 px-2 py-1.5 text-center text-xs"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs text-text-muted">
                A {money(plan.min_amount)} deposit returns{' '}
                <span className="text-success">
                  {money((plan.min_amount * totalReturnPercent(plan)) / 100)}
                </span>{' '}
                over {plan.tenure_months} months.
              </p>
              <button
                onClick={() => {
                  savePlan(plan);
                  setMessage(`${plan.name} saved.`);
                }}
                className="btn-primary"
              >
                <Save size={15} /> Save {plan.name}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
