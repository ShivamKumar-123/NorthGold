'use client';

import { useCallback, useEffect, useState } from 'react';
import { Percent, Save } from 'lucide-react';

import { Alert, EmptyState, PageLoader } from '@/components/ui';
import { ApiError, api, money, num } from '@/lib/api';
import { useRequireAdmin } from '@/lib/auth';
import type { ReferralPlan } from '@/types';

/**
 * The referral matrix.
 *
 * A sponsor earns a percentage of what their referral DEPOSITED, every month
 * that deposit pays out. Two things decide the rate and both are set here: the
 * deposit picks a slab, and the slab holds one percentage per month.
 *
 * Deliberately the same editor as the ROI plan matrix — they are the two
 * halves of what the platform pays out, and an operator who has understood one
 * screen should not have to learn a second.
 */
type Draft = {
  id: string;
  name: string;
  description: string;
  min_amount: string;
  max_amount: string | null;
  tenure_months: number;
  is_active: boolean;
  display_order: number;
  months: number[];
};

const toDraft = (plan: ReferralPlan): Draft => ({
  id: plan.id,
  name: plan.name,
  description: plan.description,
  min_amount: plan.min_amount,
  max_amount: plan.max_amount,
  tenure_months: plan.tenure_months,
  is_active: plan.is_active,
  display_order: plan.display_order,
  // The API returns a sparse list; an unconfigured month is a zero, not a gap.
  months: Array.from({ length: plan.tenure_months }, (_, i) =>
    Number(plan.months.find((m) => m.month_index === i + 1)?.percent ?? 0)),
});

export default function ReferralRatesPage() {
  const { admin, loading: authLoading } = useRequireAdmin();

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ plans: ReferralPlan[] }>('/mlm/admin/plans/');
      setDrafts(res.plans.map(toDraft));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the referral rates.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) void load();
  }, [admin, load]);

  if (authLoading || (loading && !drafts.length)) {
    return <PageLoader label="Loading referral rates" />;
  }
  if (!admin) return null;

  function setMonth(id: string, index: number, value: string) {
    const percent = Number(value);
    setDrafts((all) =>
      all.map((d) =>
        d.id === id
          ? { ...d, months: d.months.map((m, i) => (i === index ? (Number.isFinite(percent) ? percent : 0) : m)) }
          : d,
      ),
    );
  }

  /** Fill a whole slab at once — one flat rate is the common case, and typing
   *  it twelve times is how a cell ends up wrong. */
  function fillAll(id: string, value: string) {
    const percent = Number(value);
    if (!Number.isFinite(percent)) return;
    setDrafts((all) =>
      all.map((d) => (d.id === id ? { ...d, months: d.months.map(() => percent) } : d)),
    );
  }

  async function save(draft: Draft) {
    setSaving(draft.id);
    setError('');
    try {
      // The whole slab goes in one call, matrix included: saving cell by cell
      // can leave a rate table half-updated, and a half-updated rate table
      // pays real money.
      await api.put(`/mlm/admin/plans/${draft.id}/`, {
        name: draft.name,
        description: draft.description,
        min_amount: draft.min_amount,
        max_amount: draft.max_amount,
        tenure_months: draft.tenure_months,
        is_active: draft.is_active,
        display_order: draft.display_order,
        months: draft.months,
      });
      setNotice(`${draft.name} saved. It applies to months paid from now on.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save those rates.');
    } finally {
      setSaving('');
    }
  }

  const totalOf = (d: Draft) => d.months.reduce((s, m) => s + m, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Referral rates</h1>
        <p className="mt-1 text-sm text-text-muted">
          What a sponsor earns each month, as a percentage of what their
          referral deposited.
        </p>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-5"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

      <div className="mt-6">
        <Alert kind="info">
          Only the direct sponsor earns, and only while the investment is still
          running. A $1,000 deposit at 1% pays its sponsor $10 that month — the
          percentage applies to the deposit, not to the return the investor
          received.
        </Alert>
      </div>

      {drafts.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No referral slabs configured"
            description="Seed the platform, or add a slab from the API, and it will appear here."
            icon={<Percent size={26} />}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {drafts.map((draft) => (
            <section key={draft.id} className="card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{draft.name}</h2>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Deposits {money(draft.min_amount)}
                    {draft.max_amount === null ? ' and above' : ` – ${money(draft.max_amount)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="label text-[10px]" htmlFor={`fill-${draft.id}`}>
                      Set every month
                    </label>
                    <input
                      id={`fill-${draft.id}`}
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="1.00"
                      onChange={(e) => fillAll(draft.id, e.target.value)}
                      className="input w-28 py-1.5 text-xs"
                    />
                  </div>
                  <button
                    onClick={() => void save(draft)}
                    disabled={saving === draft.id}
                    className="btn-primary px-4 py-2 text-sm"
                  >
                    <Save size={14} /> {saving === draft.id ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {draft.months.map((percent, i) => (
                  <div key={i}>
                    <label className="label text-[10px]" htmlFor={`${draft.id}-m${i}`}>
                      M{i + 1}
                    </label>
                    <input
                      id={`${draft.id}-m${i}`}
                      type="number"
                      step="0.01"
                      min={0}
                      value={percent}
                      onChange={(e) => setMonth(draft.id, i, e.target.value)}
                      className="input py-1.5 text-center text-xs tabular-nums"
                    />
                  </div>
                ))}
              </div>

              <p className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-text-muted">
                <span>
                  A {money(draft.min_amount)} referral pays its sponsor{' '}
                  <strong className="text-success">
                    {money((Number(draft.min_amount) * totalOf(draft)) / 100)}
                  </strong>{' '}
                  across the whole term.
                </span>
                <span className="tabular-nums text-gold">
                  {num(totalOf(draft), 2)}% over {draft.tenure_months} months
                </span>
              </p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
