import { useState } from 'react';
import { RotateCcw, Save } from 'lucide-react';

import { Alert, ConfirmDialog } from '@/components/ui';
import { getSettings, resetDemo, saveSettings } from '@/lib/store';
import type { Settings as SettingsShape } from '@/lib/types';

export default function AdminSettings() {
  const [form, setForm] = useState<SettingsShape>(() => getSettings());
  const [message, setMessage] = useState('');
  const [resetOpen, setResetOpen] = useState(false);

  function set<K extends keyof SettingsShape>(key: K, value: SettingsShape[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-3d sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-text-muted">
          Platform rules and the contact details shown across the site.
        </p>
      </header>

      {message && (
        <div className="mt-5">
          <Alert kind="success" onDismiss={() => setMessage('')}>{message}</Alert>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveSettings(form);
          setMessage('Settings saved.');
        }}
        className="mt-6 space-y-6"
      >
        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Support desk</h2>
          <p className="mt-1 text-xs text-text-dim">
            These appear on the contact page, in the contact form, and behind the
            WhatsApp button on every signed-in screen.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Support email" value={form.support_email} onChange={(v) => set('support_email', v)} />
            <Field label="Phone" value={form.support_phone} onChange={(v) => set('support_phone', v)} />
            <Field
              label="WhatsApp number"
              hint="Digits only, with the country code — wa.me rejects '+' and spaces."
              value={form.support_whatsapp}
              onChange={(v) => set('support_whatsapp', v)}
            />
            <Field label="Opening hours" value={form.support_hours} onChange={(v) => set('support_hours', v)} />
          </div>
          <div className="mt-4">
            <Field
              label="Counter address"
              value={form.support_address}
              onChange={(v) => set('support_address', v)}
            />
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Limits</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label="Minimum deposit"
              type="number"
              value={String(form.deposit_min_amount)}
              onChange={(v) => set('deposit_min_amount', Number(v))}
            />
            <Field
              label="Minimum withdrawal"
              type="number"
              value={String(form.withdrawal_min_amount)}
              onChange={(v) => set('withdrawal_min_amount', Number(v))}
            />
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Behaviour</h2>
          <div className="mt-4 space-y-3">
            <Toggle
              label="Auto-invest on deposit"
              hint="An approved deposit immediately opens an investment on the matching plan."
              checked={form.auto_invest_on_deposit}
              onChange={(v) => set('auto_invest_on_deposit', v)}
            />
            <Toggle
              label="Pay commission on deposits"
              checked={form.mlm_deposit_enabled}
              onChange={(v) => set('mlm_deposit_enabled', v)}
            />
            <Toggle
              label="Pay commission on monthly returns"
              checked={form.mlm_roi_enabled}
              onChange={(v) => set('mlm_roi_enabled', v)}
            />
            <Field
              label="Maximum commission depth"
              type="number"
              hint="How far up the sponsor chain a payment walks."
              value={String(form.mlm_max_levels)}
              onChange={(v) => set('mlm_max_levels', Number(v))}
            />
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="btn-ghost"
          >
            <RotateCcw size={15} /> Reset demo data
          </button>
          <button type="submit" className="btn-primary">
            <Save size={15} /> Save settings
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={resetOpen}
        title="Reset the demo data?"
        body="Every member, deposit, investment and payout goes back to the seeded set. Anything created while exploring the demo is lost."
        confirmLabel="Reset everything"
        onConfirm={() => {
          resetDemo();
          setForm(getSettings());
          setMessage('Demo data reset.');
        }}
        onClose={() => setResetOpen(false)}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input" />
      {hint && <span className="mt-1 block text-xs text-text-dim">{hint}</span>}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-white/[0.02] p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[#D9A62E]"
      />
      <span>
        <span className="block text-sm text-text">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-text-dim">{hint}</span>}
      </span>
    </label>
  );
}
