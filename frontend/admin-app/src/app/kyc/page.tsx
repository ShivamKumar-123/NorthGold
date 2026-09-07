'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, ShieldCheck, X } from 'lucide-react';

import { Alert, EmptyState, Modal, PageLoader, StatusBadge } from '@/components/ui';
import { ApiError, api, dateTime } from '@/lib/api';
import { useRequireAdmin } from '@/lib/auth';

const DOC_LABELS: Record<string, string> = {
  id_front: 'ID — front',
  id_back: 'ID — back',
  selfie: 'Selfie with ID',
  address_proof: 'Proof of address',
  bank_proof: 'Bank proof',
};

type KycRow = {
  id: string;
  doc_type: string;
  file: string | null;
  status: string;
  rejection_reason: string;
  reviewed_at: string | null;
  created_at: string;
  user_id: string;
  user_email: string;
  user_name: string;
  user_kyc_status: string;
};

const STATUS_TABS = ['submitted', 'approved', 'rejected', 'all'] as const;
const TAB_LABEL: Record<string, string> = {
  submitted: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Rejected',
  all: 'All',
};

/**
 * The identity verification desk.
 *
 * Documents arrive the moment an account is opened — registration will not
 * complete without all five — so this queue is the gate between "registered"
 * and "verified". Each document is decided on its own; a member only reads as
 * approved once every one of theirs has been.
 */
export default function KycPage() {
  const { admin, loading: authLoading } = useRequireAdmin();

  const [rows, setRows] = useState<KycRow[]>([]);
  const [status, setStatus] = useState<string>('submitted');
  const [selected, setSelected] = useState<KycRow | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: KycRow[] }>(`/auth/admin/kyc/?status=${status}`);
      setRows(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the verification queue.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (admin) void load();
  }, [admin, load]);

  async function decide(doc: KycRow, action: 'approve' | 'reject', why = '') {
    setSaving(true);
    setError('');
    try {
      await api.post(`/auth/admin/kyc/${doc.id}/`, { action, reason: why });
      setNotice(
        action === 'approve'
          ? `${DOC_LABELS[doc.doc_type] ?? doc.doc_type} approved for ${doc.user_name || doc.user_email}.`
          : `${DOC_LABELS[doc.doc_type] ?? doc.doc_type} rejected. The member has been told why.`,
      );
      setSelected(null);
      setReason('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not record that decision.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) return <PageLoader label="Loading verification queue" />;
  if (!admin) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Identity verification</h1>
        <p className="mt-1 text-sm text-text-muted">
          Documents attached at signup. A member counts as verified only once
          every one of their five has been approved.
        </p>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-5"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatus(tab)}
            className={`rounded-xl border px-4 py-2 text-sm transition ${
              status === tab
                ? 'border-accent/50 bg-accent/10 text-text'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            {TAB_LABEL[tab]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-6"><PageLoader label="Loading documents" /></div>
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={status === 'submitted' ? 'Nothing waiting' : 'No documents here'}
            description={
              status === 'submitted'
                ? 'Every document submitted so far has been decided.'
                : 'Documents appear here as soon as somebody opens an account.'
            }
            icon={<ShieldCheck size={26} />}
          />
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {rows.map((doc) => (
            <div key={doc.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {doc.user_name || doc.user_email}
                  <StatusBadge status={doc.status} />
                  <span className="text-xs font-normal text-text-dim">
                    account: {doc.user_kyc_status}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {DOC_LABELS[doc.doc_type] ?? doc.doc_type.replace(/_/g, ' ')}
                  {doc.file && (
                    <>
                      {' · '}
                      <a
                        href={doc.file}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-accent hover:underline"
                      >
                        View file <ExternalLink size={11} />
                      </a>
                    </>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-text-dim">
                  {doc.user_email} · submitted {dateTime(doc.created_at)}
                  {doc.reviewed_at && ` · reviewed ${dateTime(doc.reviewed_at)}`}
                </p>
                {doc.rejection_reason && (
                  <p className="mt-1 text-xs text-danger">Reason: {doc.rejection_reason}</p>
                )}
              </div>

              {doc.status === 'submitted' ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => void decide(doc, 'approve')}
                    disabled={saving}
                    className="btn-primary px-4 py-2 text-xs"
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button
                    onClick={() => { setSelected(doc); setReason(''); }}
                    disabled={saving}
                    className="btn-danger px-4 py-2 text-xs"
                  >
                    <X size={14} /> Reject
                  </button>
                </div>
              ) : (
                <span className="text-xs text-text-dim">Decided</span>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        title="Reject this document"
        onClose={() => setSelected(null)}
        footer={
          <>
            <button onClick={() => setSelected(null)} className="btn-ghost px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              onClick={() => selected && void decide(selected, 'reject', reason.trim())}
              disabled={saving || !reason.trim()}
              className="btn-danger px-4 py-2 text-sm"
            >
              Reject document
            </button>
          </>
        }
      >
        <p className="text-sm text-text-muted">
          {selected && (
            <>
              {DOC_LABELS[selected.doc_type] ?? selected.doc_type} from{' '}
              <strong className="text-text">{selected.user_name || selected.user_email}</strong>.
            </>
          )}
        </p>
        <label className="label mt-4" htmlFor="reason">
          Why? The member sees this
        </label>
        <textarea
          id="reason"
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
