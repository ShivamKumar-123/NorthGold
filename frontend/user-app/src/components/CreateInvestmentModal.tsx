'use client';

import { useState } from 'react';

import { Alert, Modal } from '@/components/ui';
import { ApiError, api, money, num } from '@/lib/api';
import type { Investment, RoiPlan } from '@/types';

/**
 * Opening an investment out of the wallet balance.
 *
 * Shared by the Investments page and the Wallet, because "put my available
 * balance to work" is a wallet action as much as an investments one — and two
 * copies of a form that moves money would drift.
 */
export default function CreateInvestmentModal({
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
