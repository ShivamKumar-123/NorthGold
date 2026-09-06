'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Wallet } from 'lucide-react';

import NetworkTree from '@/components/NetworkTree';
import { Alert, Modal, PageLoader, StatCard, StatusBadge } from '@/components/ui';
import { ApiError, api, dateTime, money, num, shortDate } from '@/lib/api';
import { useRequireAdmin } from '@/lib/auth';
import type { Commission, NetworkSummary, TreeResponse, User } from '@/types';

type UserDetail = {
  user: User;
  network: NetworkSummary;
  kyc_documents: {
    id: string;
    doc_type: string;
    file: string;
    status: string;
    rejection_reason: string;
    reviewed_at: string | null;
    created_at: string;
  }[];
};

type NetworkDetail = {
  summary: NetworkSummary;
  earnings: {
    total_earned: number;
    direct_earned: number;
    indirect_earned: number;
    by_level: { level: number; total: number; count: number }[];
    by_trigger: Record<string, number>;
  };
  commissions: Commission[];
};

type Tab = 'overview' | 'tree' | 'commissions' | 'kyc';

export default function AdminUserDetailPage() {
  const { admin, loading: authLoading } = useRequireAdmin();
  const params = useParams<{ id: string }>();
  const userId = String(params.id || '');

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [network, setNetwork] = useState<NetworkDetail | null>(null);
  const [tree, setTree] = useState<TreeResponse | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [d, n, t] = await Promise.all([
        api.get<UserDetail>(`/auth/admin/users/${userId}/`),
        api.get<NetworkDetail>(`/mlm/admin/users/${userId}/network/`),
        api.get<TreeResponse>(`/auth/admin/users/${userId}/tree/?depth=10`),
      ]);
      setDetail(d);
      setNetwork(n);
      setTree(t);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this member.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (admin) void load();
  }, [admin, load]);

  async function updateStatus(patch: Partial<Pick<User, 'status' | 'kyc_status' | 'role'>>) {
    setError('');
    try {
      await api.patch(`/auth/admin/users/${userId}/`, patch);
      setNotice('Member updated.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update this member.');
    }
  }

  if (authLoading || (loading && !detail)) return <PageLoader label="Loading member" />;
  if (!admin) return null;

  if (!detail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Alert kind="error">{error || 'Member not found.'}</Alert>
        <Link href="/users" className="btn-ghost mt-5"><ArrowLeft size={15} /> Back to users</Link>
      </div>
    );
  }

  const u = detail.user;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link href="/users" className="mb-5 inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text">
        <ArrowLeft size={15} /> All users
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold">{u.name}</h1>
            <StatusBadge status={u.status} />
            <span className="badge bg-accent/15 text-accent">{u.role}</span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            {u.email} · <span className="font-mono text-accent">{u.referral_code}</span> · joined{' '}
            {shortDate(u.created_at)}
          </p>
          {u.sponsor && (
            <p className="mt-1 text-sm text-text-muted">
              Referred by{' '}
              <Link href={`/users/${u.sponsor.id}`} className="text-accent hover:underline">
                {u.sponsor.name}
              </Link>{' '}
              (<span className="font-mono">{u.sponsor.referral_code}</span>)
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAdjustOpen(true)} className="btn-ghost">
            <Wallet size={15} /> Adjust balance
          </button>
          {u.status === 'active' ? (
            <button onClick={() => updateStatus({ status: 'suspended' })} className="btn-danger">
              Suspend
            </button>
          ) : (
            <button onClick={() => updateStatus({ status: 'active' })} className="btn-primary">
              Reactivate
            </button>
          )}
        </div>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-5"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Wallet" value={money(u.wallet_balance)} tone="success" />
        <StatCard label="Active principal" value={money(u.invested_balance)} tone="accent" />
        <StatCard
          label="Deposited"
          value={money(u.total_deposited)}
          hint={`Withdrawn ${money(u.total_withdrawn)}`}
        />
        <StatCard
          label="Earned"
          value={money(Number(u.total_roi_earned) + Number(u.total_commission_earned))}
          hint={`${money(u.total_roi_earned)} ROI · ${money(u.total_commission_earned)} commission`}
          tone="gold"
        />
      </div>

      <div className="mt-8 flex gap-1 border-b border-border">
        {([
          ['overview', 'Overview'],
          ['tree', `Downline (${tree?.total_nodes ?? 0})`],
          ['commissions', `Commissions (${network?.commissions.length ?? 0})`],
          ['kyc', `KYC (${detail.kyc_documents.length})`],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition ${
              tab === key ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Contact</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Email" value={u.email} />
                <Row label="Phone" value={u.phone || '—'} />
                <Row label="Country" value={u.country || '—'} />
                <Row label="State" value={u.state || '—'} />
                <Row label="City" value={u.city || '—'} />
                <Row label="Address" value={u.address || '—'} />
                <Row label="KYC status" value={u.kyc_status} />
                <Row label="Email verified" value={u.email_verified ? 'Yes' : 'No'} />
              </dl>
            </section>

            <section className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
                Network summary
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <Row label="Direct referrals" value={String(detail.network.direct_count)} />
                <Row label="Total downline" value={String(detail.network.total_downline)} />
                <Row label="Team business" value={money(detail.network.team_business)} />
                <Row label="Earned from direct" value={money(network?.earnings.direct_earned)} />
                <Row label="Earned from indirect" value={money(network?.earnings.indirect_earned)} />
              </dl>

              {detail.network.levels.length > 0 && (
                <div className="table-wrap mt-4">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Level</th>
                        <th className="text-right">Members</th>
                        <th className="text-right">Business</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.network.levels.map((l) => (
                        <tr key={l.level}>
                          <td>L{l.level}</td>
                          <td className="text-right tabular-nums">{l.count}</td>
                          <td className="text-right tabular-nums">{money(l.business)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'tree' && <NetworkTree nodes={tree?.tree ?? []} />}

        {tab === 'commissions' && (
          (network?.commissions.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-12 text-center text-sm text-text-muted">
              This member has not earned any commission yet.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>From</th>
                    <th>Level</th>
                    <th>Event</th>
                    <th className="text-right">Base</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {network!.commissions.map((c) => (
                    <tr key={c.id}>
                      <td className="text-text-muted">{dateTime(c.created_at)}</td>
                      <td>
                        <p className="text-sm">{c.source_name}</p>
                        <p className="text-xs text-text-muted">{c.source_email}</p>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            c.kind === 'direct' ? 'bg-accent/15 text-accent' : 'bg-gold/15 text-gold'
                          }`}
                        >
                          L{c.level}
                        </span>
                      </td>
                      <td className="text-text-muted">{c.trigger_label}</td>
                      <td className="text-right tabular-nums text-text-muted">{money(c.base_amount)}</td>
                      <td className="text-right tabular-nums">{num(c.percent, 2)}%</td>
                      <td className="text-right tabular-nums text-success">{money(c.amount)}</td>
                      <td>
                        <StatusBadge status={c.status} />
                        {c.skip_reason && (
                          <p className="mt-1 max-w-[180px] whitespace-normal text-xs text-text-dim">
                            {c.skip_reason}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'kyc' && (
          detail.kyc_documents.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-5 py-12 text-center text-sm text-text-muted">
              No documents uploaded.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Uploaded</th>
                    <th>Reviewed</th>
                    <th>Status</th>
                    <th className="text-right">File</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.kyc_documents.map((d) => (
                    <tr key={d.id}>
                      <td>{d.doc_type.replace(/_/g, ' ')}</td>
                      <td className="text-text-muted">{dateTime(d.created_at)}</td>
                      <td className="text-text-muted">{d.reviewed_at ? dateTime(d.reviewed_at) : '—'}</td>
                      <td><StatusBadge status={d.status} /></td>
                      <td className="text-right">
                        <a href={d.file} target="_blank" rel="noopener noreferrer"
                           className="text-accent hover:underline">Open</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <AdjustBalanceModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        userId={userId}
        currentBalance={Number(u.wallet_balance)}
        onDone={async (message) => {
          setAdjustOpen(false);
          setNotice(message);
          await load();
        }}
        onError={setError}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className="break-words text-right">{value}</dd>
    </div>
  );
}

function AdjustBalanceModal({
  open,
  onClose,
  userId,
  currentBalance,
  onDone,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentBalance: number;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const value = Number(amount);
  const resulting = currentBalance + (Number.isFinite(value) ? value : 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      onError('A description is required for a manual adjustment.');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/wallet/admin/users/${userId}/adjust/`, {
        amount, description: description.trim(),
      });
      setAmount('');
      setDescription('');
      onDone(`Balance adjusted by ${money(value)}.`);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not adjust the balance.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Adjust wallet balance" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Alert kind="warn">
          This writes directly to the ledger and bypasses the deposit flow. It
          pays no referral commission and starts no investment. Every adjustment
          is recorded in the audit log against your account.
        </Alert>

        <div>
          <label className="label" htmlFor="adj-amount">
            Amount — negative to debit
          </label>
          <input
            id="adj-amount"
            type="number"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            placeholder="-50.00"
          />
          <p className="mt-1 text-xs text-text-dim">
            {money(currentBalance)} → <strong>{money(resulting)}</strong>
            {resulting < 0 && <span className="ml-2 text-danger">Would go negative — this is rejected.</span>}
          </p>
        </div>

        <div>
          <label className="label" htmlFor="adj-desc">Reason <span className="text-danger">*</span></label>
          <input
            id="adj-desc"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input"
            placeholder="e.g. Goodwill credit for delayed payout, ticket #182"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={busy || resulting < 0} className="btn-primary">
            {busy ? 'Applying…' : 'Apply adjustment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
