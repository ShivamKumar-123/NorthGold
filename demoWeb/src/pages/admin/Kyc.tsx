import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import { Alert, EmptyState, StatusBadge } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { KYC_DOC_TYPES, allKyc, getUsers, reviewKyc } from '@/lib/store';

type Filter = 'pending' | 'all';

const LABELS = Object.fromEntries(KYC_DOC_TYPES.map((d) => [d.value, d.label]));

/**
 * The identity verification desk.
 *
 * Documents arrive here the moment an account is opened — signup will not
 * complete without all five — so this queue is the gate between "registered"
 * and "verified". Each document is decided on its own; the member's account
 * only reads as approved once every one of theirs has been.
 */
export default function AdminKyc() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [message, setMessage] = useState('');

  const docs = allKyc();
  const users = getUsers();

  const rows = useMemo(
    () => (filter === 'pending' ? docs.filter((d) => d.status === 'pending') : docs),
    [docs, filter],
  );
  const pendingCount = docs.filter((d) => d.status === 'pending').length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-3d sm:text-3xl">Identity verification</h1>
        <p className="mt-1 text-sm text-text-muted">
          Documents attached at signup. A member counts as verified only once
          every one of their five has been approved.
        </p>
      </header>

      {message && (
        <div className="mt-5">
          <Alert kind="success" onDismiss={() => setMessage('')}>{message}</Alert>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(['pending', 'all'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`rounded-xl border px-4 py-2 text-sm capitalize transition ${
              filter === value
                ? 'border-accent/50 bg-accent/10 text-text'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            {value === 'pending' ? `Awaiting review (${pendingCount})` : `All (${docs.length})`}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={filter === 'pending' ? 'Nothing waiting' : 'No documents yet'}
            description={
              filter === 'pending'
                ? 'Every document submitted so far has been decided.'
                : 'Documents appear here as soon as somebody opens an account.'
            }
            icon={<ShieldCheck size={26} />}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {rows.map((doc) => {
            const owner = users.find((u) => u.id === doc.user_id);
            return (
              <div key={doc.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {owner
                      ? `${owner.first_name} ${owner.last_name}`.trim() || owner.email
                      : 'Unknown member'}
                    <StatusBadge status={doc.status} />
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {LABELS[doc.doc_type] ?? doc.doc_type.replace(/_/g, ' ')} · {doc.file_name}
                  </p>
                  <p className="mt-0.5 text-xs text-text-dim">
                    {owner?.email} · submitted {dateTime(doc.created_at)}
                    {doc.reviewed_at && ` · reviewed ${dateTime(doc.reviewed_at)}`}
                  </p>
                  {doc.rejection_reason && (
                    <p className="mt-1 text-xs text-danger">Reason: {doc.rejection_reason}</p>
                  )}
                </div>

                {doc.status === 'pending' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        reviewKyc(doc.id, true);
                        setMessage('Document approved.');
                      }}
                      className="btn-primary px-4 py-2 text-xs"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        const reason = window.prompt('Why is this being rejected? The member sees it.');
                        if (!reason?.trim()) return;
                        reviewKyc(doc.id, false, reason.trim());
                        setMessage('Document rejected.');
                      }}
                      className="btn-danger px-4 py-2 text-xs"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-text-dim">Decided</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
