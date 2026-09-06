'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, MessageSquareText, X } from 'lucide-react';

import { Alert, EmptyState, Modal, PageLoader, StatCard, StatusBadge } from '@/components/ui';
import { ApiError, api, dateTime, money } from '@/lib/api';
import type { Paginated } from '@/types';

type Kind = 'deposit' | 'withdrawal';

type Row = {
  id: string;
  amount: string;
  currency: string;
  method: string;
  method_label: string;
  user_message: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  rejection_reason: string;
  admin_note: string;
  user_email: string;
  user_name: string;
  // deposit-only
  reference_no?: string;
  proof?: string | null;
  channel_name?: string | null;
  user_total_deposited?: string;
  // withdrawal-only
  fee?: string;
  net_amount?: string;
  payout_details?: Record<string, string>;
  payout_reference?: string;
  user_wallet_balance?: string;
};

const STATUS_TABS = ['pending', 'approved', 'rejected', ''] as const;
const TAB_LABEL: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  '': 'All',
};

/**
 * Shared verification queue for deposits and withdrawals.
 *
 * The two flows differ only in their fields and the copy on the decision
 * dialog — the queue mechanics, filters and audit affordances are identical,
 * so they share one component rather than two near-copies that drift.
 */
export default function ReviewQueue({ kind }: { kind: Kind }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<string>('pending');
  const [selected, setSelected] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const base = kind === 'deposit' ? '/wallet/admin/deposits/' : '/wallet/admin/withdrawals/';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The list endpoint defaults to pending when no status is supplied, so an
      // explicit `status=` is needed to mean "all".
      const query = status ? `?status=${status}&per_page=100` : '?status=&per_page=100';
      const res = await api.get<Paginated<Row>>(`${base}${query}`);
      setRows(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the queue.');
    } finally {
      setLoading(false);
    }
  }, [base, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingTotal = rows
    .filter((r) => r.status === 'pending')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  if (loading && !rows.length) return <PageLoader label={`Loading ${kind}s`} />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold">
          {kind === 'deposit' ? 'Deposit verification' : 'Withdrawal approvals'}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">
          {kind === 'deposit'
            ? 'Nothing is credited until you approve it. For cash deposits, the member’s message is the evidence — check it against your records before approving.'
            : 'The amount was already held when the member requested it. Approving settles the record; rejecting returns the funds to their wallet.'}
        </p>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-5"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="In this view" value={String(rows.length)} />
        <StatCard
          label="Pending here"
          value={String(rows.filter((r) => r.status === 'pending').length)}
          tone="accent"
        />
        <StatCard label="Pending value" value={money(pendingTotal)} tone="gold" />
      </div>

      <div className="mt-6 flex gap-1 border-b border-border">
        {STATUS_TABS.map((value) => (
          <button
            key={value || 'all'}
            onClick={() => setStatus(value)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition ${
              status === value
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {TAB_LABEL[value]}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title={status === 'pending' ? 'Nothing waiting' : 'No records'}
            description={
              status === 'pending'
                ? `Every ${kind} has been reviewed.`
                : `No ${kind}s match this filter.`
            }
            icon={<Check size={26} />}
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Member</th>
                  <th>Method</th>
                  <th className="text-right">Amount</th>
                  {kind === 'withdrawal' && <th className="text-right">They receive</th>}
                  <th>Message / reference</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="text-text-muted">{dateTime(row.created_at)}</td>
                    <td>
                      <p className="font-medium">{row.user_name}</p>
                      <p className="text-xs text-text-muted">{row.user_email}</p>
                    </td>
                    <td>
                      <span className={`badge ${row.method === 'cash' ? 'bg-warn/15 text-warn' : 'bg-bg-elevated text-text-muted'}`}>
                        {row.method_label}
                      </span>
                    </td>
                    <td className="text-right font-medium tabular-nums">
                      {money(row.amount, row.currency)}
                    </td>
                    {kind === 'withdrawal' && (
                      <td className="text-right tabular-nums text-text-muted">
                        {money(row.net_amount, row.currency)}
                      </td>
                    )}
                    <td className="max-w-[280px]">
                      {row.user_message ? (
                        <p className="flex items-start gap-1.5 whitespace-normal text-xs text-text-muted">
                          <MessageSquareText size={12} className="mt-0.5 shrink-0" />
                          {row.user_message.length > 110
                            ? `${row.user_message.slice(0, 110)}…`
                            : row.user_message}
                        </p>
                      ) : (
                        <span className="font-mono text-xs text-text-dim">
                          {row.reference_no || row.payout_reference || '—'}
                        </span>
                      )}
                    </td>
                    <td><StatusBadge status={row.status} /></td>
                    <td className="text-right">
                      <button onClick={() => setSelected(row)} className="btn-ghost py-1.5 text-xs">
                        {row.status === 'pending' ? 'Review' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <ReviewModal
          kind={kind}
          row={selected}
          onClose={() => setSelected(null)}
          onDone={async (message) => {
            setSelected(null);
            setNotice(message);
            await load();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function ReviewModal({
  kind,
  row,
  onClose,
  onDone,
  onError,
}: {
  kind: Kind;
  row: Row;
  onClose: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [autoInvest, setAutoInvest] = useState(true);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  const base = kind === 'deposit' ? '/wallet/admin/deposits/' : '/wallet/admin/withdrawals/';
  const readOnly = row.status !== 'pending';

  async function act(action: 'approve' | 'reject') {
    if (action === 'reject' && !reason.trim()) {
      onError('Give the member a reason for the rejection.');
      return;
    }
    setBusy(action);
    try {
      const body: Record<string, unknown> = { action };
      if (action === 'approve') {
        body.admin_note = note;
        if (kind === 'deposit') body.auto_invest = autoInvest;
        else body.payout_reference = reference;
      } else {
        body.reason = reason;
      }

      const res = await api.post<Row & { investment_created?: string | null }>(
        `${base}${row.id}/review/`,
        body,
      );

      if (action === 'approve') {
        onDone(
          kind === 'deposit'
            ? `Deposit of ${money(row.amount)} approved.` +
              (res.investment_created
                ? ' It was invested automatically and now earns monthly returns.'
                : ' It sits in the member’s wallet.') +
              ' Referral commission has been paid to their upline.'
            : `Withdrawal of ${money(row.amount)} marked as paid.`,
        );
      } else {
        onDone(
          kind === 'deposit'
            ? `Deposit rejected. Nothing was credited.`
            : `Withdrawal rejected. ${money(row.amount)} has been returned to the member’s wallet.`,
        );
      }
    } catch (err) {
      onError(err instanceof ApiError ? err.message : `Could not ${action} this ${kind}.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      open
      title={`${kind === 'deposit' ? 'Deposit' : 'Withdrawal'} — ${money(row.amount, row.currency)}`}
      onClose={onClose}
      width="max-w-2xl"
      footer={
        readOnly ? (
          <button onClick={onClose} className="btn-ghost">Close</button>
        ) : (
          <>
            <button onClick={onClose} className="btn-ghost">Cancel</button>
            <button onClick={() => act('reject')} disabled={busy !== null} className="btn-danger">
              <X size={15} /> {busy === 'reject' ? 'Rejecting…' : 'Reject'}
            </button>
            <button onClick={() => act('approve')} disabled={busy !== null} className="btn-primary">
              <Check size={15} /> {busy === 'approve' ? 'Approving…' : 'Approve'}
            </button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Detail label="Member" value={`${row.user_name} (${row.user_email})`} />
          <Detail label="Requested" value={dateTime(row.created_at)} />
          <Detail label="Method" value={row.method_label} />
          <Detail label="Status" value={row.status} />
          {kind === 'deposit' && (
            <>
              <Detail label="Channel" value={row.channel_name || '—'} />
              <Detail label="Reference" value={row.reference_no || '—'} />
              <Detail
                label="Member lifetime deposits"
                value={money(row.user_total_deposited)}
              />
            </>
          )}
          {kind === 'withdrawal' && (
            <>
              <Detail label="Fee" value={money(row.fee, row.currency)} />
              <Detail label="They receive" value={money(row.net_amount, row.currency)} />
              <Detail
                label="Member wallet balance"
                value={money(row.user_wallet_balance)}
              />
            </>
          )}
        </div>

        {row.user_message && (
          <div
            className={`rounded-lg border p-4 ${
              row.method === 'cash' ? 'border-warn/40 bg-warn/8' : 'border-border bg-bg-elevated'
            }`}
          >
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
              <MessageSquareText size={13} /> Message from the member
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{row.user_message}</p>
            {row.method === 'cash' && (
              <p className="mt-3 border-t border-warn/25 pt-2.5 text-xs text-warn">
                This is a cash payment — there is no bank trail. Verify this
                account against your receipts before approving.
              </p>
            )}
          </div>
        )}

        {kind === 'withdrawal' && row.payout_details && Object.keys(row.payout_details).length > 0 && (
          <div className="rounded-lg border border-border bg-bg-elevated p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Send to</p>
            <dl className="mt-2 space-y-1.5 text-sm">
              {Object.entries(row.payout_details).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4">
                  <dt className="text-text-muted">{key.replace(/_/g, ' ')}</dt>
                  <dd className="break-all text-right font-mono text-xs">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {row.proof && (
          <a
            href={row.proof}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost w-full"
          >
            <ExternalLink size={15} /> Open payment proof
          </a>
        )}

        {readOnly ? (
          <>
            {row.admin_note && <Detail label="Admin note" value={row.admin_note} />}
            {row.rejection_reason && (
              <Alert kind="error">Rejected: {row.rejection_reason}</Alert>
            )}
            {row.reviewed_at && <Detail label="Reviewed" value={dateTime(row.reviewed_at)} />}
          </>
        ) : (
          <div className="space-y-4 border-t border-border pt-4">
            {kind === 'deposit' && (
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={autoInvest}
                  onChange={(e) => setAutoInvest(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
                />
                <span>
                  <span className="block text-sm font-medium">
                    Start the investment immediately
                  </span>
                  <span className="block text-xs text-text-muted">
                    Locks the full amount into the plan matching its slab, so the
                    monthly return clock starts today. Untick to leave the money
                    in the member&apos;s wallet.
                  </span>
                </span>
              </label>
            )}

            {kind === 'withdrawal' && (
              <div>
                <label className="label" htmlFor="payout-ref">Payout reference</label>
                <input
                  id="payout-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="input"
                  placeholder="UTR / transaction id / cash receipt no."
                />
              </div>
            )}

            <div>
              <label className="label" htmlFor="admin-note">Internal note (on approval)</label>
              <input
                id="admin-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input"
                placeholder="Optional — visible in the audit log"
              />
            </div>

            <div>
              <label className="label" htmlFor="reject-reason">Reason (required to reject)</label>
              <textarea
                id="reject-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input resize-none"
                placeholder="Shown to the member, so be specific."
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-text-dim">{label}</p>
      <p className="mt-0.5 break-words text-sm">{value}</p>
    </div>
  );
}
