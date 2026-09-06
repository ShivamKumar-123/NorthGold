'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, Play, Plus, Save, Trash2, Wand2 } from 'lucide-react';

import { Alert, EmptyState, Modal, PageLoader } from '@/components/ui';
import { ApiError, api, money, num } from '@/lib/api';
import { useRequireAdmin } from '@/lib/auth';
import type { RoiPlan } from '@/types';

type MonthRow = { month_index: number; percent: string };

type Draft = {
  id?: string;
  name: string;
  description: string;
  min_amount: string;
  max_amount: string;
  tenure_months: number;
  return_principal_at_maturity: boolean;
  allow_early_exit: boolean;
  early_exit_penalty_percent: string;
  is_active: boolean;
  display_order: number;
  months: MonthRow[];
};

function emptyDraft(): Draft {
  return {
    name: '',
    description: '',
    min_amount: '',
    max_amount: '',
    tenure_months: 12,
    return_principal_at_maturity: true,
    allow_early_exit: false,
    early_exit_penalty_percent: '0',
    is_active: true,
    display_order: 0,
    months: Array.from({ length: 12 }, (_, i) => ({ month_index: i + 1, percent: '1.000' })),
  };
}

function toDraft(plan: RoiPlan): Draft {
  const byIndex = new Map(plan.months.map((m) => [m.month_index, m.percent]));
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    min_amount: plan.min_amount,
    max_amount: plan.max_amount ?? '',
    tenure_months: plan.tenure_months,
    return_principal_at_maturity: plan.return_principal_at_maturity,
    allow_early_exit: plan.allow_early_exit,
    early_exit_penalty_percent: plan.early_exit_penalty_percent,
    is_active: plan.is_active,
    display_order: plan.display_order,
    months: Array.from({ length: plan.tenure_months }, (_, i) => ({
      month_index: i + 1,
      percent: byIndex.get(i + 1) ?? '0.000',
    })),
  };
}

export default function RoiPlansPage() {
  const { admin, loading: authLoading } = useRequireAdmin();

  const [plans, setPlans] = useState<RoiPlan[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPlans(await api.get<RoiPlan[]>('/investments/admin/plans/'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) void load();
  }, [admin, load]);

  async function runPayouts() {
    setRunning(true);
    setError('');
    try {
      const res = await api.post<{
        investments_processed: number; months_paid: number; amount_paid: number;
        matured: number; errors: number;
      }>('/investments/admin/run-payouts/');
      setNotice(
        `Sweep complete — ${res.months_paid} month(s) paid across ${res.investments_processed} ` +
        `investment(s), totalling ${money(res.amount_paid)}. ${res.matured} matured, ${res.errors} error(s).`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The payout run failed.');
    } finally {
      setRunning(false);
    }
  }

  if (authLoading || (loading && !plans.length)) return <PageLoader label="Loading ROI plans" />;
  if (!admin) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ROI plans</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Each plan is a deposit slab plus a percentage for every month of its
            term. A deposit lands in the slab that covers its amount, then earns
            month 1&apos;s rate in its first month, month 2&apos;s in its second, and so on.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={runPayouts} disabled={running} className="btn-ghost">
            <Play size={15} /> {running ? 'Running…' : 'Run payouts now'}
          </button>
          <button onClick={() => setDraft(emptyDraft())} className="btn-primary">
            <Plus size={15} /> New plan
          </button>
        </div>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-5"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

      <div className="mt-6 space-y-4">
        {plans.length === 0 ? (
          <EmptyState
            title="No plans configured"
            description="Until at least one plan exists, deposits cannot be auto-invested and nothing earns a return."
            action={<button onClick={() => setDraft(emptyDraft())} className="btn-primary">Create the first plan</button>}
          />
        ) : (
          plans.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              onEdit={() => setDraft(toDraft(plan))}
              onDuplicate={() => {
                const copy = toDraft(plan);
                delete copy.id;
                copy.name = `${plan.name} (copy)`;
                setDraft(copy);
              }}
            />
          ))
        )}
      </div>

      {draft && (
        <PlanEditor
          draft={draft}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSaved={async (message) => {
            setDraft(null);
            setNotice(message);
            await load();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function PlanRow({
  plan,
  onEdit,
  onDuplicate,
}: {
  plan: RoiPlan;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{plan.name}</h2>
            <span className={`badge ${plan.is_active ? 'bg-success/15 text-success' : 'bg-text-dim/15 text-text-muted'}`}>
              {plan.is_active ? 'active' : 'inactive'}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {money(plan.min_amount)} – {plan.max_amount ? money(plan.max_amount) : 'no cap'} ·{' '}
            {plan.tenure_months} months ·{' '}
            {plan.return_principal_at_maturity ? 'principal returned' : 'principal held'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-text-dim">Total yield</p>
            <p className="text-lg font-semibold tabular-nums text-gold">
              {num(plan.total_return_percent, 2)}%
            </p>
          </div>
          <button onClick={onDuplicate} className="btn-ghost" title="Duplicate this plan">
            <Copy size={15} />
          </button>
          <button onClick={onEdit} className="btn-primary">Edit matrix</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-12">
        {Array.from({ length: plan.tenure_months }, (_, i) => {
          const month = plan.months.find((m) => m.month_index === i + 1);
          const value = Number(month?.percent ?? 0);
          return (
            <div
              key={i}
              className={`rounded-lg border p-2 text-center ${
                value > 0 ? 'border-border bg-bg-elevated' : 'border-dashed border-border'
              }`}
            >
              <p className="text-[10px] text-text-dim">M{i + 1}</p>
              <p className={`text-xs font-medium tabular-nums ${value > 0 ? 'text-success' : 'text-text-dim'}`}>
                {num(value, 2)}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanEditor({
  draft,
  onChange,
  onClose,
  onSaved,
  onError,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [rampFrom, setRampFrom] = useState('1.0');
  const [rampTo, setRampTo] = useState('2.5');

  const total = useMemo(
    () => draft.months.reduce((sum, m) => sum + (Number(m.percent) || 0), 0),
    [draft.months],
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    onChange({ ...draft, [key]: value });
  }

  function setTenure(months: number) {
    const clamped = Math.max(1, Math.min(60, months || 1));
    const existing = new Map(draft.months.map((m) => [m.month_index, m.percent]));
    onChange({
      ...draft,
      tenure_months: clamped,
      months: Array.from({ length: clamped }, (_, i) => ({
        month_index: i + 1,
        percent: existing.get(i + 1) ?? '0.000',
      })),
    });
  }

  function setMonth(index: number, percent: string) {
    onChange({
      ...draft,
      months: draft.months.map((m) => (m.month_index === index ? { ...m, percent } : m)),
    });
  }

  /** Fill the whole curve by linear interpolation — the common shape by far. */
  function applyRamp() {
    const from = Number(rampFrom);
    const to = Number(rampTo);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return;
    const n = draft.months.length;
    onChange({
      ...draft,
      months: draft.months.map((m, i) => ({
        ...m,
        percent: (n === 1 ? from : from + ((to - from) * i) / (n - 1)).toFixed(3),
      })),
    });
  }

  function applyFlat() {
    onChange({ ...draft, months: draft.months.map((m) => ({ ...m, percent: rampFrom })) });
  }

  async function save() {
    if (!draft.name.trim()) {
      onError('The plan needs a name.');
      return;
    }
    if (draft.min_amount === '') {
      onError('Set a minimum amount for this slab.');
      return;
    }
    if (draft.max_amount !== '' && Number(draft.max_amount) < Number(draft.min_amount)) {
      onError('The maximum amount must be at least the minimum.');
      return;
    }

    const payload = {
      name: draft.name.trim(),
      description: draft.description,
      min_amount: draft.min_amount,
      max_amount: draft.max_amount === '' ? null : draft.max_amount,
      tenure_months: draft.tenure_months,
      return_principal_at_maturity: draft.return_principal_at_maturity,
      allow_early_exit: draft.allow_early_exit,
      early_exit_penalty_percent: draft.early_exit_penalty_percent || '0',
      is_active: draft.is_active,
      display_order: draft.display_order,
      months: draft.months.map((m) => ({
        month_index: m.month_index,
        percent: m.percent === '' ? '0' : m.percent,
      })),
    };

    setSaving(true);
    try {
      if (draft.id) {
        await api.put(`/investments/admin/plans/${draft.id}/`, payload);
        onSaved(`Plan "${payload.name}" updated. Existing investments keep their original terms.`);
      } else {
        await api.post('/investments/admin/plans/', payload);
        onSaved(`Plan "${payload.name}" created.`);
      }
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not save the plan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={draft.id ? `Edit plan — ${draft.name}` : 'New ROI plan'}
      onClose={onClose}
      width="max-w-4xl"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary">
            <Save size={15} /> {saving ? 'Saving…' : 'Save plan'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {draft.id && (
          <Alert kind="info">
            Editing a plan only affects <strong>new</strong> investments. Existing
            ones hold a frozen copy of the terms they were sold on.
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="p-name">Plan name</label>
            <input id="p-name" value={draft.name} onChange={(e) => set('name', e.target.value)}
                   className="input" placeholder="Silver" />
          </div>
          <div>
            <label className="label" htmlFor="p-order">Display order</label>
            <input id="p-order" type="number" value={draft.display_order}
                   onChange={(e) => set('display_order', Number(e.target.value))} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="p-min">Minimum deposit</label>
            <input id="p-min" type="number" step="0.01" value={draft.min_amount}
                   onChange={(e) => set('min_amount', e.target.value)} className="input" placeholder="1000" />
          </div>
          <div>
            <label className="label" htmlFor="p-max">Maximum deposit</label>
            <input id="p-max" type="number" step="0.01" value={draft.max_amount}
                   onChange={(e) => set('max_amount', e.target.value)} className="input"
                   placeholder="Leave blank for an open-ended top tier" />
          </div>
          <div>
            <label className="label" htmlFor="p-tenure">Term (months)</label>
            <input id="p-tenure" type="number" min={1} max={60} value={draft.tenure_months}
                   onChange={(e) => setTenure(Number(e.target.value))} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="p-penalty">Early-exit penalty %</label>
            <input id="p-penalty" type="number" step="0.01" value={draft.early_exit_penalty_percent}
                   onChange={(e) => set('early_exit_penalty_percent', e.target.value)} className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="p-desc">Description</label>
            <textarea id="p-desc" rows={2} value={draft.description}
                      onChange={(e) => set('description', e.target.value)}
                      className="input resize-none" placeholder="Shown on the landing page." />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <Toggle label="Active" checked={draft.is_active} onChange={(v) => set('is_active', v)} />
          <Toggle label="Return principal at maturity" checked={draft.return_principal_at_maturity}
                  onChange={(v) => set('return_principal_at_maturity', v)} />
          <Toggle label="Allow early exit" checked={draft.allow_early_exit}
                  onChange={(v) => set('allow_early_exit', v)} />
        </div>

        {/* The matrix */}
        <div className="rounded-lg border border-border">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">Monthly percentages</h3>
              <p className="text-xs text-text-muted">
                Percent of the original principal paid in each month.
              </p>
            </div>
            <p className="text-sm">
              <span className="text-text-muted">Total yield:</span>{' '}
              <span className="font-semibold tabular-nums text-gold">{num(total, 3)}%</span>
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-b border-border bg-bg-elevated px-4 py-3">
            <div>
              <label className="label" htmlFor="ramp-from">From %</label>
              <input id="ramp-from" type="number" step="0.001" value={rampFrom}
                     onChange={(e) => setRampFrom(e.target.value)} className="input w-24" />
            </div>
            <div>
              <label className="label" htmlFor="ramp-to">To %</label>
              <input id="ramp-to" type="number" step="0.001" value={rampTo}
                     onChange={(e) => setRampTo(e.target.value)} className="input w-24" />
            </div>
            <button type="button" onClick={applyRamp} className="btn-ghost">
              <Wand2 size={14} /> Ramp across months
            </button>
            <button type="button" onClick={applyFlat} className="btn-ghost">
              Flat at {rampFrom}%
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-6">
            {draft.months.map((m) => (
              <div key={m.month_index}>
                <label className="label" htmlFor={`m-${m.month_index}`}>Month {m.month_index}</label>
                <div className="relative">
                  <input
                    id={`m-${m.month_index}`}
                    type="number"
                    step="0.001"
                    min="0"
                    value={m.percent}
                    onChange={(e) => setMonth(m.month_index, e.target.value)}
                    className="input pr-7 text-right tabular-nums"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-dim">
                    %
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {Number(draft.min_amount) > 0 && (
          <div className="rounded-lg border border-border bg-bg-elevated p-4 text-sm">
            A {money(draft.min_amount)} deposit under this plan would return{' '}
            <strong className="text-success">
              {money((Number(draft.min_amount) * total) / 100)}
            </strong>{' '}
            over {draft.tenure_months} months
            {draft.return_principal_at_maturity ? ', plus the principal back at maturity.' : '.'}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border accent-accent"
      />
      {label}
    </label>
  );
}
