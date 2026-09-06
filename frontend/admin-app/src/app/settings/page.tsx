'use client';

import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';

import { Alert, PageLoader } from '@/components/ui';
import { ApiError, api, dateTime } from '@/lib/api';
import { useRequireAdmin } from '@/lib/auth';

type SettingsMap = Record<string, unknown>;

type AuditRow = {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};

/** Grouped so the page reads as sections rather than one long list of keys. */
const GROUPS: { title: string; blurb: string; keys: [string, string, string][] }[] = [
  {
    title: 'Investments',
    blurb: 'How an approved deposit turns into monthly returns.',
    keys: [
      ['auto_invest_on_deposit', 'boolean',
       'Automatically invest an approved deposit into the plan matching its amount slab. With this off, the money lands in the wallet and the member must invest it themselves.'],
      ['roi_credit_target', 'choice:wallet|principal',
       'Where a monthly return goes. "wallet" is withdrawable; "principal" compounds it into the locked amount so the next month pays on a larger base.'],
    ],
  },
  {
    title: 'Referral commission',
    blurb: 'Global switches — the per-level percentages live on the MLM levels page.',
    keys: [
      ['mlm_deposit_enabled', 'boolean', 'Pay the upline a one-off commission when a downline deposit is approved.'],
      ['mlm_roi_enabled', 'boolean', 'Pay the upline every time a downline member receives their monthly return.'],
      ['mlm_max_levels', 'number', 'Hard ceiling on how far up the sponsor chain the engine walks.'],
      ['mlm_require_active_investment', 'boolean', 'Require an upline to hold an active investment before they can earn.'],
    ],
  },
  {
    title: 'Wallet limits',
    blurb: 'Minimums and fees applied at request time.',
    keys: [
      ['deposit_min_amount', 'decimal', 'Smallest deposit a member may request.'],
      ['withdrawal_min_amount', 'decimal', 'Smallest withdrawal a member may request.'],
      ['withdrawal_fee_percent', 'decimal', 'Percentage deducted from a withdrawal. The member sees the net figure before confirming.'],
    ],
  },
  {
    title: 'Branding',
    blurb: 'Shown on the public site.',
    keys: [
      ['platform_name', 'text', 'Platform name.'],
      ['support_email', 'text', 'Support address shown in the footer.'],
    ],
  },
];

export default function SettingsPage() {
  const { admin, loading: authLoading } = useRequireAdmin();

  const [settings, setSettings] = useState<SettingsMap>({});
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [config, logs] = await Promise.all([
        api.get<{ settings: SettingsMap }>('/core/admin/settings/'),
        api.get<{ items: AuditRow[] }>('/core/admin/audit-logs/'),
      ]);
      setSettings(config.settings);
      setAudit(logs.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) void load();
  }, [admin, load]);

  function set(key: string, value: unknown) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function save() {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await api.put('/core/admin/settings/', { settings });
      setNotice('Settings saved. They take effect immediately — no restart needed.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the settings.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || (loading && !Object.keys(settings).length)) return <PageLoader label="Loading settings" />;
  if (!admin) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="mt-1 text-sm text-text-muted">
            Runtime configuration. Changes apply to every event from the moment
            you save.
          </p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary">
          <Save size={15} /> {saving ? 'Saving…' : 'Save settings'}
        </button>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-5"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

      <div className="mt-6 space-y-5">
        {GROUPS.map((group) => (
          <section key={group.title} className="card p-5">
            <h2 className="font-semibold">{group.title}</h2>
            <p className="mt-0.5 text-sm text-text-muted">{group.blurb}</p>

            <div className="mt-4 space-y-4">
              {group.keys.map(([key, kind, help]) => (
                <SettingRow
                  key={key}
                  name={key}
                  kind={kind}
                  help={help}
                  value={settings[key]}
                  onChange={(v) => set(key, v)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          Recent admin activity
        </h2>
        {audit.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-text-muted">
            No admin actions recorded yet.
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {audit.slice(0, 40).map((row) => (
                  <tr key={row.id}>
                    <td className="text-text-muted">{dateTime(row.created_at)}</td>
                    <td>{row.actor_email || <span className="text-text-dim">system</span>}</td>
                    <td>
                      <span className="badge bg-bg-elevated text-text-muted">
                        {row.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="text-xs text-text-muted">
                      {row.entity_type}
                      {row.entity_id && <span className="ml-1 font-mono">{row.entity_id.slice(0, 8)}</span>}
                    </td>
                    <td className="font-mono text-xs text-text-dim">{row.ip_address || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SettingRow({
  name,
  kind,
  help,
  value,
  onChange,
}: {
  name: string;
  kind: string;
  help: string;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = name.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

  if (kind === 'boolean') {
    return (
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-accent"
        />
        <span>
          <span className="block text-sm font-medium">{label}</span>
          <span className="block text-xs leading-relaxed text-text-muted">{help}</span>
        </span>
      </label>
    );
  }

  if (kind.startsWith('choice:')) {
    const options = kind.slice(7).split('|');
    return (
      <div>
        <label className="label" htmlFor={name}>{label}</label>
        <select
          id={name}
          value={String(value ?? options[0])}
          onChange={(e) => onChange(e.target.value)}
          className="input max-w-xs"
        >
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">{help}</p>
      </div>
    );
  }

  const inputType = kind === 'number' || kind === 'decimal' ? 'number' : 'text';
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input
        id={name}
        type={inputType}
        step={kind === 'decimal' ? '0.01' : undefined}
        value={String(value ?? '')}
        onChange={(e) =>
          onChange(kind === 'number' ? Number(e.target.value) : e.target.value)
        }
        className="input max-w-xs"
      />
      <p className="mt-1 text-xs leading-relaxed text-text-muted">{help}</p>
    </div>
  );
}
