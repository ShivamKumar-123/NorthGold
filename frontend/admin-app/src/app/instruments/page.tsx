'use client';

import { useCallback, useEffect, useState } from 'react';
import { DollarSign, Plus, Radio } from 'lucide-react';

import { Alert, EmptyState, Modal, PageLoader } from '@/components/ui';
import { ApiError, api, dateTime, money, num, pct } from '@/lib/api';
import { useRequireAdmin } from '@/lib/auth';
import type { Instrument, Issuer, Paginated, RoiPlan } from '@/types';

type Draft = Partial<Instrument> & { id?: string };

const CATEGORIES = [
  ['fixed_deposit', 'Fixed Deposit'],
  ['recurring_deposit', 'Recurring Deposit'],
  ['bond', 'Bond'],
  ['mutual_fund', 'Mutual Fund'],
  ['etf', 'ETF'],
  ['commodity', 'Commodity'],
  ['forex', 'Forex'],
  ['crypto', 'Crypto'],
  ['other', 'Other'],
] as const;

export default function AdminInstrumentsPage() {
  const { admin, loading: authLoading } = useRequireAdmin();

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [plans, setPlans] = useState<RoiPlan[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pricing, setPricing] = useState<Instrument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, issuerList, planList] = await Promise.all([
        api.get<Paginated<Instrument>>('/instruments/admin/?per_page=100'),
        api.get<Issuer[]>('/instruments/admin/issuers/'),
        api.get<RoiPlan[]>('/investments/admin/plans/'),
      ]);
      setInstruments(list.items);
      setIssuers(issuerList);
      setPlans(planList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load instruments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) void load();
  }, [admin, load]);

  if (authLoading || (loading && !instruments.length)) return <PageLoader label="Loading instruments" />;
  if (!admin) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Instruments</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            What appears on the landing page. A <strong>manual</strong> instrument
            only moves when you set a price here; a <strong>feed</strong> instrument
            is moved by the ticker and broadcast live.
          </p>
        </div>
        <button
          onClick={() =>
            setDraft({
              name: '', symbol: '', category: 'fixed_deposit', currency: 'USD',
              interest_rate: '8.000', tenure_months: 12, min_investment: '1000',
              price_source: 'manual', current_price: '100.0000',
              is_active: true, is_featured: false, display_order: 0, description: '',
            })
          }
          className="btn-primary"
        >
          <Plus size={15} /> New instrument
        </button>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-5"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

      <div className="mt-6">
        {instruments.length === 0 ? (
          <EmptyState
            title="Nothing listed"
            description="The landing page price board will be empty until you add an instrument."
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Issuer</th>
                  <th>Plan</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right">Min</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Change</th>
                  <th>Source</th>
                  <th>Flags</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {instruments.map((i) => {
                  const change = Number(i.change_percent);
                  return (
                    <tr key={i.id}>
                      <td>
                        <p className="font-medium">{i.name}</p>
                        <p className="font-mono text-xs text-accent">{i.symbol}</p>
                      </td>
                      <td className="text-text-muted">{i.issuer_name || '—'}</td>
                      <td className="text-text-muted">{i.plan_name || <span className="text-text-dim">by amount</span>}</td>
                      <td className="text-right tabular-nums text-gold">{num(i.interest_rate, 2)}%</td>
                      <td className="text-right tabular-nums">{money(i.min_investment, i.currency)}</td>
                      <td className="text-right tabular-nums">{num(i.current_price, 2)}</td>
                      <td className={`text-right tabular-nums ${change >= 0 ? 'text-success' : 'text-danger'}`}>
                        {pct(change)}
                      </td>
                      <td>
                        <span className={`badge ${i.price_source === 'feed' ? 'bg-success/15 text-success' : 'bg-bg-elevated text-text-muted'}`}>
                          {i.price_source === 'feed' ? <><Radio size={11} /> live</> : 'manual'}
                        </span>
                      </td>
                      <td className="space-x-1">
                        {i.is_featured && <span className="badge bg-gold/15 text-gold">featured</span>}
                        {!i.is_active && <span className="badge bg-danger/15 text-danger">hidden</span>}
                      </td>
                      <td className="space-x-1 text-right">
                        <button onClick={() => setPricing(i)} className="btn-ghost py-1.5 text-xs">
                          <DollarSign size={12} /> Price
                        </button>
                        <button onClick={() => setDraft(i)} className="btn-ghost py-1.5 text-xs">Edit</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {draft && (
        <InstrumentEditor
          draft={draft}
          issuers={issuers}
          plans={plans}
          onClose={() => setDraft(null)}
          onSaved={async (msg) => { setDraft(null); setNotice(msg); await load(); }}
          onError={setError}
        />
      )}

      {pricing && (
        <PriceEditor
          instrument={pricing}
          onClose={() => setPricing(null)}
          onSaved={async (msg) => { setPricing(null); setNotice(msg); await load(); }}
          onError={setError}
        />
      )}
    </div>
  );
}

function InstrumentEditor({
  draft,
  issuers,
  plans,
  onClose,
  onSaved,
  onError,
}: {
  draft: Draft;
  issuers: Issuer[];
  plans: RoiPlan[];
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
    if (!form.name?.trim() || !form.symbol?.trim()) {
      onError('Name and symbol are both required.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      symbol: form.symbol.trim().toUpperCase(),
      issuer: form.issuer || null,
      category: form.category,
      description: form.description ?? '',
      currency: form.currency || 'USD',
      interest_rate: form.interest_rate || '0',
      tenure_months: form.tenure_months ?? 12,
      min_investment: form.min_investment || '0',
      max_investment: form.max_investment === '' ? null : form.max_investment ?? null,
      roi_plan: form.roi_plan || null,
      price_source: form.price_source || 'manual',
      current_price: form.current_price || '0',
      is_active: form.is_active ?? true,
      is_featured: form.is_featured ?? false,
      display_order: form.display_order ?? 0,
    };

    setBusy(true);
    try {
      if (form.id) {
        await api.patch(`/instruments/admin/${form.id}/`, payload);
        onSaved(`${payload.symbol} updated.`);
      } else {
        await api.post('/instruments/admin/', payload);
        onSaved(`${payload.symbol} created.`);
      }
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not save the instrument.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={form.id ? `Edit ${form.symbol}` : 'New instrument'}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Name" value={form.name ?? ''} onChange={(v) => set('name', v)} />
        <Text label="Symbol" value={form.symbol ?? ''} onChange={(v) => set('symbol', v.toUpperCase())} mono />

        <Select label="Issuer" value={form.issuer ?? ''} onChange={(v) => set('issuer', v || null)}
                options={[['', 'None'], ...issuers.map((i) => [i.id, i.name] as [string, string])]} />
        <Select label="Category" value={form.category ?? 'fixed_deposit'}
                onChange={(v) => set('category', v)} options={CATEGORIES.map((c) => [c[0], c[1]])} />

        <Text label="Advertised rate % p.a." value={form.interest_rate ?? ''} type="number"
              onChange={(v) => set('interest_rate', v)} />
        <Text label="Term (months)" value={String(form.tenure_months ?? 12)} type="number"
              onChange={(v) => set('tenure_months', Number(v))} />

        <Text label="Minimum investment" value={form.min_investment ?? ''} type="number"
              onChange={(v) => set('min_investment', v)} />
        <Text label="Maximum investment" value={form.max_investment ?? ''} type="number"
              onChange={(v) => set('max_investment', v)} hint="Blank for no cap" />

        <div className="sm:col-span-2">
          <Select
            label="ROI plan"
            value={form.roi_plan ?? ''}
            onChange={(v) => set('roi_plan', v || null)}
            options={[
              ['', 'Select from the invested amount instead'],
              ...plans.map((p) => [p.id, `${p.name} — ${num(p.total_return_percent, 2)}% over ${p.tenure_months}mo`] as [string, string]),
            ]}
            hint="Decides what an investment here actually pays, month by month."
          />
        </div>

        <Select label="Price source" value={form.price_source ?? 'manual'}
                onChange={(v) => set('price_source', v as 'manual' | 'feed')}
                options={[['manual', 'Admin-managed'], ['feed', 'Live feed']]} />
        <Text label="Current price" value={form.current_price ?? ''} type="number"
              onChange={(v) => set('current_price', v)} />

        <Text label="Currency" value={form.currency ?? 'USD'} onChange={(v) => set('currency', v)} />
        <Text label="Display order" value={String(form.display_order ?? 0)} type="number"
              onChange={(v) => set('display_order', Number(v))} />

        <div className="sm:col-span-2">
          <label className="label" htmlFor="i-desc">Description</label>
          <textarea id="i-desc" rows={3} value={form.description ?? ''}
                    onChange={(e) => set('description', e.target.value)} className="input resize-none" />
        </div>

        <div className="flex gap-5 sm:col-span-2">
          <Check label="Active (visible on the site)" checked={form.is_active ?? true}
                 onChange={(v) => set('is_active', v)} />
          <Check label="Featured" checked={form.is_featured ?? false}
                 onChange={(v) => set('is_featured', v)} />
        </div>
      </div>
    </Modal>
  );
}

function PriceEditor({
  instrument,
  onClose,
  onSaved,
  onError,
}: {
  instrument: Instrument;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [price, setPrice] = useState(instrument.current_price);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.post(`/instruments/admin/${instrument.id}/price/`, { price });
      onSaved(`${instrument.symbol} priced at ${num(price, 4)} and broadcast to every open page.`);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not set the price.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={`Set price — ${instrument.symbol}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={busy} className="btn-primary">
            {busy ? 'Publishing…' : 'Publish price'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {instrument.price_source === 'feed' && (
          <Alert kind="warn">
            This instrument is on the live feed. Setting a price here works, but
            the ticker will move it again on its next run. Switch it to
            admin-managed if you want the price to stay put.
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Mini label="Current" value={num(instrument.current_price, 4)} />
          <Mini label="Previous close" value={num(instrument.previous_close, 4)} />
          <Mini label="Last updated" value={instrument.price_updated_at ? dateTime(instrument.price_updated_at) : '—'} />
        </div>

        <div>
          <label className="label" htmlFor="new-price">New price</label>
          <input id="new-price" type="number" step="0.0001" min="0" value={price}
                 onChange={(e) => setPrice(e.target.value)} className="input text-right tabular-nums" />
          <p className="mt-1 text-xs text-text-dim">
            The current value rolls into &ldquo;previous close&rdquo;, so the change
            indicator on the landing card reflects this edit.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function Text({
  label, value, onChange, type = 'text', hint, mono,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; hint?: string; mono?: boolean;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)}
             className={`input ${mono ? 'font-mono' : ''}`} />
      {hint && <p className="mt-1 text-xs text-text-dim">{hint}</p>}
    </div>
  );
}

function Select({
  label, value, onChange, options, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: [string, string][]; hint?: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {hint && <p className="mt-1 text-xs text-text-dim">{hint}</p>}
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
             className="h-4 w-4 rounded border-border accent-accent" />
      {label}
    </label>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-3">
      <p className="text-[10px] uppercase tracking-wide text-text-dim">{label}</p>
      <p className="mt-1 text-sm tabular-nums">{value}</p>
    </div>
  );
}
