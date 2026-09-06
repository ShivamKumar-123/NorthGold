'use client';

import { useCallback, useEffect, useState } from 'react';
import { Banknote, Bitcoin, Building2, Plus, Smartphone } from 'lucide-react';

import { Alert, EmptyState, Modal, PageLoader } from '@/components/ui';
import { ApiError, api, money } from '@/lib/api';
import { useRequireAdmin } from '@/lib/auth';
import type { PaymentChannel, PaymentMethod } from '@/types';

const TYPE_ICON: Record<PaymentMethod, React.ReactNode> = {
  cash: <Banknote size={15} />,
  bank: <Building2 size={15} />,
  upi: <Smartphone size={15} />,
  crypto: <Bitcoin size={15} />,
};

type Draft = Partial<PaymentChannel> & { id?: string };

export default function ChannelsPage() {
  const { admin, loading: authLoading } = useRequireAdmin();

  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setChannels(await api.get<PaymentChannel[]>('/wallet/admin/channels/'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load payment channels.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) void load();
  }, [admin, load]);

  if (authLoading || (loading && !channels.length)) return <PageLoader label="Loading channels" />;
  if (!admin) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Payment channels</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Where members send money. Each active channel appears in the deposit
            dialog under its method, with the details and instructions you set here.
          </p>
        </div>
        <button
          onClick={() => setDraft({ name: '', channel_type: 'bank', is_active: true, min_amount: '0', display_order: 0 })}
          className="btn-primary"
        >
          <Plus size={15} /> New channel
        </button>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-5"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {channels.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState
              title="No channels configured"
              description="Members cannot be told where to send money until you add at least one."
            />
          </div>
        ) : (
          channels.map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 font-medium">
                    {TYPE_ICON[c.channel_type]} {c.name}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">{c.channel_type_label}</p>
                </div>
                <span className={`badge ${c.is_active ? 'bg-success/15 text-success' : 'bg-text-dim/15 text-text-muted'}`}>
                  {c.is_active ? 'active' : 'inactive'}
                </span>
              </div>

              <dl className="mt-4 space-y-1.5 text-xs">
                {c.channel_type === 'bank' && (
                  <>
                    <Row label="Account" value={c.account_number} />
                    <Row label="Bank" value={c.bank_name} />
                    <Row label="IFSC" value={c.ifsc_code} />
                  </>
                )}
                {c.channel_type === 'upi' && <Row label="UPI ID" value={c.upi_id} />}
                {c.channel_type === 'crypto' && (
                  <>
                    <Row label="Address" value={c.wallet_address} />
                    <Row label="Network" value={c.network} />
                  </>
                )}
                {c.channel_type === 'cash' && (
                  <>
                    <Row label="Contact" value={c.contact_person} />
                    <Row label="Phone" value={c.contact_phone} />
                  </>
                )}
                <Row
                  label="Limits"
                  value={`${money(c.min_amount)} – ${c.max_amount ? money(c.max_amount) : 'no cap'}`}
                />
              </dl>

              <button onClick={() => setDraft(c)} className="btn-ghost mt-4 w-full">Edit</button>
            </div>
          ))
        )}
      </div>

      {draft && (
        <ChannelEditor
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={async (msg) => { setDraft(null); setNotice(msg); await load(); }}
          onError={setError}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="break-all text-right font-mono">{value}</dd>
    </div>
  );
}

function ChannelEditor({
  draft,
  onClose,
  onSaved,
  onError,
}: {
  draft: Draft;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [form, setForm] = useState<Draft>(draft);
  const [busy, setBusy] = useState(false);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    if (!form.name?.trim()) {
      onError('Give the channel a name — members see it in the deposit dialog.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      channel_type: form.channel_type,
      account_name: form.account_name ?? '',
      account_number: form.account_number ?? '',
      bank_name: form.bank_name ?? '',
      ifsc_code: form.ifsc_code ?? '',
      branch: form.branch ?? '',
      upi_id: form.upi_id ?? '',
      wallet_address: form.wallet_address ?? '',
      network: form.network ?? '',
      contact_person: form.contact_person ?? '',
      contact_phone: form.contact_phone ?? '',
      office_address: form.office_address ?? '',
      instructions: form.instructions ?? '',
      min_amount: form.min_amount || '0',
      max_amount: form.max_amount === '' ? null : form.max_amount ?? null,
      is_active: form.is_active ?? true,
      display_order: form.display_order ?? 0,
    };

    setBusy(true);
    try {
      if (form.id) {
        await api.patch(`/wallet/admin/channels/${form.id}/`, payload);
        onSaved(`${payload.name} updated.`);
      } else {
        await api.post('/wallet/admin/channels/', payload);
        onSaved(`${payload.name} created.`);
      }
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not save the channel.');
    } finally {
      setBusy(false);
    }
  }

  const type = form.channel_type ?? 'bank';

  return (
    <Modal
      open
      title={form.id ? `Edit ${form.name}` : 'New payment channel'}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Save channel'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Channel name" value={form.name ?? ''} onChange={(v) => set('name', v)} />
        <div>
          <label className="label" htmlFor="ch-type">Method</label>
          <select
            id="ch-type"
            value={type}
            onChange={(e) => set('channel_type', e.target.value as PaymentMethod)}
            className="input"
          >
            <option value="cash">Cash</option>
            <option value="bank">Bank transfer</option>
            <option value="upi">UPI</option>
            <option value="crypto">Crypto</option>
          </select>
        </div>

        {type === 'bank' && (
          <>
            <Field label="Account holder" value={form.account_name ?? ''} onChange={(v) => set('account_name', v)} />
            <Field label="Account number" value={form.account_number ?? ''} onChange={(v) => set('account_number', v)} />
            <Field label="Bank name" value={form.bank_name ?? ''} onChange={(v) => set('bank_name', v)} />
            <Field label="IFSC / SWIFT" value={form.ifsc_code ?? ''} onChange={(v) => set('ifsc_code', v)} />
            <Field label="Branch" value={form.branch ?? ''} onChange={(v) => set('branch', v)} />
          </>
        )}

        {type === 'upi' && (
          <Field label="UPI ID" value={form.upi_id ?? ''} onChange={(v) => set('upi_id', v)} />
        )}

        {type === 'crypto' && (
          <>
            <Field label="Wallet address" value={form.wallet_address ?? ''} onChange={(v) => set('wallet_address', v)} />
            <Field label="Network" value={form.network ?? ''} onChange={(v) => set('network', v)} />
          </>
        )}

        {type === 'cash' && (
          <>
            <Field label="Contact person" value={form.contact_person ?? ''} onChange={(v) => set('contact_person', v)} />
            <Field label="Contact phone" value={form.contact_phone ?? ''} onChange={(v) => set('contact_phone', v)} />
            <div className="sm:col-span-2">
              <label className="label" htmlFor="ch-office">Office address</label>
              <textarea id="ch-office" rows={2} value={form.office_address ?? ''}
                        onChange={(e) => set('office_address', e.target.value)} className="input resize-none" />
            </div>
          </>
        )}

        <Field label="Minimum amount" type="number" value={form.min_amount ?? '0'}
               onChange={(v) => set('min_amount', v)} />
        <Field label="Maximum amount" type="number" value={form.max_amount ?? ''}
               onChange={(v) => set('max_amount', v)} hint="Blank for no cap" />

        <div className="sm:col-span-2">
          <label className="label" htmlFor="ch-instructions">Instructions for the member</label>
          <textarea
            id="ch-instructions"
            rows={3}
            value={form.instructions ?? ''}
            onChange={(e) => set('instructions', e.target.value)}
            className="input resize-none"
            placeholder="e.g. Transfer, then enter the UTR as your reference number."
          />
        </div>

        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active ?? true}
                   onChange={(e) => set('is_active', e.target.checked)}
                   className="h-4 w-4 rounded border-border accent-accent" />
            Active — shown to members in the deposit dialog
          </label>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label, value, onChange, type = 'text', hint,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input" />
      {hint && <p className="mt-1 text-xs text-text-dim">{hint}</p>}
    </div>
  );
}
