import { useEffect, useState } from 'react';
import { Percent, Save } from 'lucide-react';

import { Alert, EmptyState } from '@/components/ui';
import { money, num } from '@/lib/format';
import { getReferralPlans, saveReferralPlans, subscribe } from '@/lib/store';
import type { ReferralPlan } from '@/lib/types';

/**
 * The referral matrix.
 *
 * A sponsor earns a percentage of what their referral DEPOSITED, every month
 * that deposit pays out. Two things decide the rate and both are set here: the
 * deposit picks a slab, and the slab holds one percentage per month.
 *
 * Deliberately the same editor as the ROI plan matrix. They are the two halves
 * of what the platform pays out, and an operator who has understood one screen
 * should not have to learn a second.
 */
export default function AdminReferralRates() {
  const [draft, setDraft] = useState<ReferralPlan[]>(() => getReferralPlans());
  const [message, setMessage] = useState('');
  const [, tick] = useState(0);

  useEffect(() => subscribe(() => tick((n) => n + 1)), []);

  function setMonth(planId: string, monthIndex: number, value: string) {
    const percent = Number(value);
    setDraft((plans) =>
      plans.map((p) =>
        p.id === planId
          ? { ...p, months: p.months.map((m, i) => (i === monthIndex ? (Number.isFinite(percent) ? percent : 0) : m)) }
          : p,
      ),
    );
  }

  /** Fill every month of a slab at once — the common case is one flat rate,
   *  and typing it twelve times is how a cell ends up wrong. */
  function fillAll(planId: string, value: string) {
    const percent = Number(value);
    if (!Number.isFinite(percent)) return;
    setDraft((plans) =>
      plans.map((p) => (p.id === planId ? { ...p, months: p.months.map(() => percent) } : p)),
    );
  }

  function save() {
    saveReferralPlans(draft);
    setMessage('Referral rates saved. They apply to months paid from now on.');
  }

  const totalOf = (plan: ReferralPlan) => plan.months.reduce((s, m) => s + m, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-3d sm:text-3xl">Referral rates</h1>
          <p className="mt-1 text-sm text-text-muted">
            What a sponsor earns each month, as a percentage of what their
            referral deposited.
          </p>
        </div>
        <button onClick={save} className="btn-primary">
          <Save size={15} /> Save rates
        </button>
      </header>

      {message && (
        <div className="mt-5">
          <Alert kind="success" onDismiss={() => setMessage('')}>{message}</Alert>
        </div>
      )}

      <div className="mt-6">
        <Alert kind="info">
        Only the direct sponsor earns, and only while the investment is still
        running. A $1,000 deposit at 1% pays its sponsor $10 in that month —
        the percentage applies to the deposit, not to the return the investor
        received.
        </Alert>
      </div>

      {draft.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No referral slabs configured" icon={<Percent size={26} />} />
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {draft.map((plan) => (
            <section key={plan.id} className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{plan.name}</h2>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Deposits {money(plan.min_amount)}
                    {plan.max_amount === null ? ' and above' : ` – ${money(plan.max_amount)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="label text-[10px]" htmlFor={`fill-${plan.id}`}>
                      Set every month
                    </label>
                    <input
                      id={`fill-${plan.id}`}
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="1.00"
                      onChange={(e) => fillAll(plan.id, e.target.value)}
                      className="input w-28 py-1.5 text-xs"
                    />
                  </div>
                  <p className="pb-1 text-right text-xs text-text-muted">
                    Total over {plan.tenure_months} months
                    <span className="ml-2 tabular-nums text-gold">
                      {num(totalOf(plan), 2)}%
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {plan.months.map((percent, i) => (
                  <div key={i}>
                    <label className="label text-[10px]" htmlFor={`${plan.id}-m${i}`}>
                      M{i + 1}
                    </label>
                    <input
                      id={`${plan.id}-m${i}`}
                      type="number"
                      step="0.01"
                      min={0}
                      value={percent}
                      onChange={(e) => setMonth(plan.id, i, e.target.value)}
                      className="input py-1.5 text-center text-xs tabular-nums"
                    />
                  </div>
                ))}
              </div>

              {/* What one deposit at the floor of this slab actually costs. */}
              <p className="mt-3 border-t border-border pt-3 text-xs text-text-muted">
                A {money(plan.min_amount)} referral pays its sponsor{' '}
                <strong className="text-success">
                  {money((plan.min_amount * totalOf(plan)) / 100)}
                </strong>{' '}
                across the whole term.
              </p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
