import { useState } from 'react';
import { Check, X } from 'lucide-react';

import { Alert, EmptyState, StatusBadge } from '@/components/ui';
import { dateTime, money } from '@/lib/format';
import { getUsers } from '@/lib/store';
import type { RequestStatus } from '@/lib/types';

type Row = {
  id: string;
  user_id: string;
  amount: number;
  user_message: string;
  reference?: string;
  status: RequestStatus;
  admin_note: string;
  created_at: string;
  reviewed_at: string | null;
};

/**
 * The shared deposit/withdrawal review table.
 *
 * Both queues do the same three things — read a request, take a note, approve
 * or reject — so they share a component rather than a copy each. What differs
 * is only the wording and what the two verbs mean downstream, which the
 * caller supplies.
 */
export default function ReviewQueue({
  title,
  description,
  rows,
  amountLabel,
  messageLabel,
  onApprove,
  onReject,
  emptyTitle,
  emptyIcon,
  note,
}: {
  title: string;
  description: string;
  rows: Row[];
  amountLabel: string;
  messageLabel: string;
  onApprove: (id: string, note: string) => void;
  onReject: (id: string, note: string) => void;
  emptyTitle: string;
  emptyIcon: React.ReactNode;
  /** The consequence of approving, spelled out above the table. */
  note: string;
}) {
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  const users = getUsers();
  const nameFor = (id: string) => {
    const u = users.find((x) => x.id === id);
    return u ? { name: `${u.first_name} ${u.last_name}`.trim() || u.email, email: u.email } : null;
  };

  const visible = filter === 'pending' ? rows.filter((r) => r.status === 'pending') : rows;
  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-3d sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-border bg-white/[0.02] p-1">
          {([['pending', `Pending (${pendingCount})`], ['all', `All (${rows.length})`]] as const).map(
            ([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-xs transition ${
                  filter === key ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text'
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </header>

      {message && (
        <div className="mt-5">
          <Alert kind="success" onDismiss={() => setMessage('')}>{message}</Alert>
        </div>
      )}

      <div className="mt-5">
        <Alert kind="info">{note}</Alert>
      </div>

      {visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={emptyTitle}
            description="Nothing is waiting on you right now."
            icon={emptyIcon}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {visible.map((row) => {
            const who = nameFor(row.user_id);
            const pending = row.status === 'pending';
            return (
              <div key={row.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-text">{who?.name ?? 'Unknown member'}</p>
                      <StatusBadge status={row.status} />
                      {row.reference && (
                        <span className="font-mono text-[11px] text-accent">{row.reference}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">{who?.email}</p>
                    <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-text-dim">
                      {messageLabel}
                    </p>
                    <p className="mt-1 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
                      {row.user_message || '—'}
                    </p>
                    {row.admin_note && (
                      <p className="mt-2 text-xs text-text-dim">
                        Your note: <span className="text-text-muted">{row.admin_note}</span>
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-text-dim">
                      {amountLabel}
                    </p>
                    <p className="text-2xl font-semibold tabular-nums text-text">
                      {money(row.amount)}
                    </p>
                    <p className="mt-1 text-xs text-text-dim">{dateTime(row.created_at)}</p>
                    {row.reviewed_at && (
                      <p className="text-xs text-text-dim">
                        Reviewed {dateTime(row.reviewed_at)}
                      </p>
                    )}
                  </div>
                </div>

                {pending && (
                  <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
                    <input
                      value={notes[row.id] ?? ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [row.id]: e.target.value }))}
                      placeholder="Note (visible to the member)"
                      className="input flex-1"
                    />
                    <button
                      onClick={() => {
                        onApprove(row.id, notes[row.id] ?? '');
                        setMessage('Approved.');
                      }}
                      className="btn-primary shrink-0"
                    >
                      <Check size={15} /> Approve
                    </button>
                    <button
                      onClick={() => {
                        // A rejection without a reason leaves the member with
                        // no idea what to fix, so it is required here.
                        const reason = notes[row.id]?.trim();
                        if (!reason) {
                          setMessage('');
                          window.alert('Give a reason before rejecting — the member sees it.');
                          return;
                        }
                        onReject(row.id, reason);
                        setMessage('Rejected.');
                      }}
                      className="btn-danger shrink-0"
                    >
                      <X size={15} /> Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
