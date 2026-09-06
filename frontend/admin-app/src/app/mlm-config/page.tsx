'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Plus, Save, Trash2 } from 'lucide-react';

import { Alert, PageLoader } from '@/components/ui';
import { ApiError, api, money, num } from '@/lib/api';
import { useRequireAdmin } from '@/lib/auth';
import type { MlmLevel } from '@/types';

type LevelRow = {
  level: number;
  label: string;
  deposit_percent: string;
  roi_percent: string;
  min_direct_referrals: number;
  min_self_investment: string;
  is_active: boolean;
};

type ConfigResponse = {
  levels: MlmLevel[];
  deposit_commission_enabled: boolean;
  roi_commission_enabled: boolean;
  max_levels: number;
  require_active_investment: boolean;
};

const SAMPLE_DEPOSIT = 1000;
const SAMPLE_ROI = 20;

export default function MlmConfigPage() {
  const { admin, loading: authLoading } = useRequireAdmin();

  const [rows, setRows] = useState<LevelRow[]>([]);
  const [settings, setSettings] = useState({
    mlm_deposit_enabled: true,
    mlm_roi_enabled: true,
    mlm_max_levels: 5,
    mlm_require_active_investment: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await api.get<ConfigResponse>('/mlm/admin/config/');
      setRows(
        config.levels
          .map((l) => ({
            level: l.level,
            label: l.label,
            deposit_percent: l.deposit_percent,
            roi_percent: l.roi_percent,
            min_direct_referrals: l.min_direct_referrals,
            min_self_investment: l.min_self_investment,
            is_active: l.is_active,
          }))
          .sort((a, b) => a.level - b.level),
      );
      setSettings({
        mlm_deposit_enabled: config.deposit_commission_enabled,
        mlm_roi_enabled: config.roi_commission_enabled,
        mlm_max_levels: config.max_levels,
        mlm_require_active_investment: config.require_active_investment,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the MLM configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) void load();
  }, [admin, load]);

  const totals = useMemo(
    () => ({
      deposit: rows.reduce((s, r) => s + (r.is_active ? Number(r.deposit_percent) || 0 : 0), 0),
      roi: rows.reduce((s, r) => s + (r.is_active ? Number(r.roi_percent) || 0 : 0), 0),
    }),
    [rows],
  );

  function update(level: number, patch: Partial<LevelRow>) {
    setRows((prev) => prev.map((r) => (r.level === level ? { ...r, ...patch } : r)));
  }

  function addLevel() {
    const next = rows.length ? Math.max(...rows.map((r) => r.level)) + 1 : 1;
    setRows((prev) => [
      ...prev,
      {
        level: next,
        label: next === 1 ? 'Direct' : `Indirect L${next}`,
        deposit_percent: '0.000',
        roi_percent: '0.000',
        min_direct_referrals: 0,
        min_self_investment: '0',
        is_active: true,
      },
    ]);
  }

  /** Removing anything but the deepest level would leave a gap, which the API
   *  rejects — so only the last row is removable. */
  function removeLast() {
    setRows((prev) => prev.slice(0, -1));
  }

  async function save() {
    setError('');
    setNotice('');
    if (!rows.length) {
      setError('At least one level is required.');
      return;
    }
    setSaving(true);
    try {
      await api.put('/mlm/admin/config/', {
        levels: rows.map((r) => ({
          level: r.level,
          label: r.label,
          deposit_percent: r.deposit_percent || '0',
          roi_percent: r.roi_percent || '0',
          min_direct_referrals: r.min_direct_referrals || 0,
          min_self_investment: r.min_self_investment || '0',
          is_active: r.is_active,
        })),
      });
      await api.put('/core/admin/settings/', { settings });
      setNotice('Commission structure saved. It applies to every event from now on.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the configuration.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || (loading && !rows.length)) return <PageLoader label="Loading MLM configuration" />;
  if (!admin) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">MLM levels</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">
            Level 1 is a <strong>direct</strong> referral. Levels 2 and beyond are{' '}
            <strong>indirect</strong> — your referral&apos;s referrals, and deeper.
            Each level earns on both events independently.
          </p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary">
          <Save size={15} /> {saving ? 'Saving…' : 'Save structure'}
        </button>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-5"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

      {/* Global switches */}
      <div className="mt-6 card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          Global switches
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Toggle
            label="Pay on deposits"
            hint="One-off, when a downline deposit is approved"
            checked={settings.mlm_deposit_enabled}
            onChange={(v) => setSettings({ ...settings, mlm_deposit_enabled: v })}
          />
          <Toggle
            label="Pay on monthly returns"
            hint="Recurring, every time a downline receives ROI"
            checked={settings.mlm_roi_enabled}
            onChange={(v) => setSettings({ ...settings, mlm_roi_enabled: v })}
          />
          <Toggle
            label="Require an active investment"
            hint="Uplines must hold principal to earn"
            checked={settings.mlm_require_active_investment}
            onChange={(v) => setSettings({ ...settings, mlm_require_active_investment: v })}
          />
          <div>
            <label className="label" htmlFor="max-levels">Max chain depth</label>
            <input
              id="max-levels"
              type="number"
              min={1}
              max={25}
              value={settings.mlm_max_levels}
              onChange={(e) => setSettings({ ...settings, mlm_max_levels: Number(e.target.value) })}
              className="input"
            />
            <p className="mt-1 text-xs text-text-dim">
              Hard ceiling on how far up the engine walks.
            </p>
          </div>
        </div>
      </div>

      {/* Level table */}
      <div className="mt-6 card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            Level percentages
          </h2>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-text-muted">
              Total on deposit:{' '}
              <strong className={totals.deposit > 100 ? 'text-danger' : 'text-gold'}>
                {num(totals.deposit, 2)}%
              </strong>
            </span>
            <span className="text-text-muted">
              Total on ROI:{' '}
              <strong className={totals.roi > 100 ? 'text-danger' : 'text-gold'}>
                {num(totals.roi, 2)}%
              </strong>
            </span>
          </div>
        </div>

        <div className="table-wrap border-0">
          <table className="data">
            <thead>
              <tr>
                <th>Level</th>
                <th>Label</th>
                <th className="text-right">On deposit %</th>
                <th className="text-right">On monthly ROI %</th>
                <th className="text-right">Min directs</th>
                <th className="text-right">Min own principal</th>
                <th className="text-center">Active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.level}>
                  <td>
                    <span className="font-medium">L{row.level}</span>
                    <span
                      className={`ml-2 badge ${
                        row.level === 1 ? 'bg-accent/15 text-accent' : 'bg-gold/15 text-gold'
                      }`}
                    >
                      {row.level === 1 ? 'direct' : 'indirect'}
                    </span>
                  </td>
                  <td>
                    <input
                      value={row.label}
                      onChange={(e) => update(row.level, { label: e.target.value })}
                      className="input py-1.5"
                      aria-label={`Level ${row.level} label`}
                    />
                  </td>
                  <td>
                    <input
                      type="number" step="0.001" min="0"
                      value={row.deposit_percent}
                      onChange={(e) => update(row.level, { deposit_percent: e.target.value })}
                      className="input w-24 py-1.5 text-right tabular-nums"
                      aria-label={`Level ${row.level} deposit percent`}
                    />
                  </td>
                  <td>
                    <input
                      type="number" step="0.001" min="0"
                      value={row.roi_percent}
                      onChange={(e) => update(row.level, { roi_percent: e.target.value })}
                      className="input w-24 py-1.5 text-right tabular-nums"
                      aria-label={`Level ${row.level} ROI percent`}
                    />
                  </td>
                  <td>
                    <input
                      type="number" min="0"
                      value={row.min_direct_referrals}
                      onChange={(e) => update(row.level, { min_direct_referrals: Number(e.target.value) })}
                      className="input w-20 py-1.5 text-right tabular-nums"
                      aria-label={`Level ${row.level} minimum direct referrals`}
                    />
                  </td>
                  <td>
                    <input
                      type="number" step="0.01" min="0"
                      value={row.min_self_investment}
                      onChange={(e) => update(row.level, { min_self_investment: e.target.value })}
                      className="input w-28 py-1.5 text-right tabular-nums"
                      aria-label={`Level ${row.level} minimum own investment`}
                    />
                  </td>
                  <td className="text-center">
                    <input
                      type="checkbox"
                      checked={row.is_active}
                      onChange={(e) => update(row.level, { is_active: e.target.checked })}
                      className="h-4 w-4 rounded border-border accent-accent"
                      aria-label={`Level ${row.level} active`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p className="flex items-center gap-1.5 text-xs text-text-muted">
            <Info size={13} />
            Levels must run 1, 2, 3… with no gaps — only the deepest can be removed.
          </p>
          <div className="flex gap-2">
            {rows.length > 1 && (
              <button onClick={removeLast} className="btn-ghost text-danger">
                <Trash2 size={14} /> Remove L{rows[rows.length - 1].level}
              </button>
            )}
            <button onClick={addLevel} className="btn-ghost">
              <Plus size={14} /> Add level
            </button>
          </div>
        </div>
      </div>

      {/* Worked example */}
      <div className="mt-6 card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
          What this pays out
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          If a member deposits {money(SAMPLE_DEPOSIT)} and later receives a{' '}
          {money(SAMPLE_ROI)} monthly return, their upline earns:
        </p>

        <div className="table-wrap mt-4">
          <table className="data">
            <thead>
              <tr>
                <th>Level</th>
                <th className="text-right">From the {money(SAMPLE_DEPOSIT)} deposit</th>
                <th className="text-right">From each {money(SAMPLE_ROI)} monthly return</th>
                <th>Qualification</th>
              </tr>
            </thead>
            <tbody>
              {rows.filter((r) => r.is_active).map((row) => (
                <tr key={row.level}>
                  <td className="font-medium">
                    L{row.level} <span className="text-xs text-text-dim">{row.label}</span>
                  </td>
                  <td className="text-right tabular-nums text-success">
                    {settings.mlm_deposit_enabled
                      ? money((SAMPLE_DEPOSIT * Number(row.deposit_percent)) / 100)
                      : <span className="text-text-dim">disabled</span>}
                  </td>
                  <td className="text-right tabular-nums text-success">
                    {settings.mlm_roi_enabled
                      ? money((SAMPLE_ROI * Number(row.roi_percent)) / 100)
                      : <span className="text-text-dim">disabled</span>}
                  </td>
                  <td className="text-xs text-text-muted">
                    {row.min_direct_referrals > 0 || Number(row.min_self_investment) > 0
                      ? [
                          row.min_direct_referrals > 0 && `${row.min_direct_referrals} direct referrals`,
                          Number(row.min_self_investment) > 0 &&
                            `${money(row.min_self_investment)} own principal`,
                        ].filter(Boolean).join(' + ')
                      : 'None'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-medium">
                <td>Total paid out</td>
                <td className="text-right tabular-nums text-gold">
                  {money((SAMPLE_DEPOSIT * totals.deposit) / 100)}
                </td>
                <td className="text-right tabular-nums text-gold">
                  {money((SAMPLE_ROI * totals.roi) / 100)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {(totals.deposit > 100 || totals.roi > 100) && (
          <div className="mt-4">
            <Alert kind="error">
              Your level percentages add up to more than 100%. The platform would
              pay out more than it takes in on every qualifying event.
            </Alert>
          </div>
        )}
      </div>
    </div>
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
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
      />
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-text-muted">{hint}</span>}
      </span>
    </label>
  );
}
