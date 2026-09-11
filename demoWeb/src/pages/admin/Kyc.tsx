import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import { Alert, EmptyState, Modal, StatusBadge } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { allKyc, getUsers, KYC_DOC_TYPES, PROOF_TYPES, reviewKyc } from '@/lib/store';
import type { KycDoc } from '@/lib/types';

type Filter = 'pending' | 'all';

const LABELS = Object.fromEntries(KYC_DOC_TYPES.map((d) => [d.value, d.label]));

/** Which identity document the ID pages are — a reviewer needs it to know what
 *  number format they are checking against. */
const PROOF_LABELS = Object.fromEntries(PROOF_TYPES.map((p) => [p.value, p.label]));

/**
 * The identity verification desk.
 *
 * Documents arrive here the moment an account is opened — signup will not
 * complete without all of them — so this queue is the gate between "registered"
 * and "verified". Each document is decided on its own; the member's account
 * only reads as approved once every one of theirs has been.
 */
export default function AdminKyc() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [message, setMessage] = useState('');
  // The document being rejected, and the reason being written for it. A
  // rejection without a reason leaves the member with nothing to fix, so it is
  // collected in a dialog rather than assumed.
  const [rejecting, setRejecting] = useState<KycDoc | null>(null);
  const [reason, setReason] = useState('');

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
                    {doc.proof_type && (
                      <span className="ml-2 badge bg-accent/15 text-accent">
                        {PROOF_LABELS[doc.proof_type] ?? doc.proof_type}
                      </span>
                    )}
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
                        setRejecting(doc);
                        setReason('');
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

      <Modal
        open={Boolean(rejecting)}
        title="Reject this document"
        onClose={() => setRejecting(null)}
        width="max-w-md"
        footer={
          <>
            <button onClick={() => setRejecting(null)} className="btn-ghost px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              onClick={() => {
                if (!rejecting || !reason.trim()) return;
                reviewKyc(rejecting.id, false, reason.trim());
                setRejecting(null);
                setMessage('Document rejected.');
              }}
              disabled={!reason.trim()}
              className="btn-danger px-4 py-2 text-sm"
            >
              Reject document
            </button>
          </>
        }
      >
        <p className="text-sm text-text-muted">
          {rejecting && (
            <>
              {LABELS[rejecting.doc_type] ?? rejecting.doc_type} from{' '}
              <strong className="text-text">
                {users.find((u) => u.id === rejecting.user_id)?.email ?? 'this member'}
              </strong>.
            </>
          )}
        </p>
        <label className="label mt-4" htmlFor="kyc-reason">
          Why? The member sees this
        </label>
        <textarea
          id="kyc-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="input resize-none"
          placeholder="The photo is cut off — please re-upload with all four corners visible."
        />
      </Modal>
    </div>
  );
}
