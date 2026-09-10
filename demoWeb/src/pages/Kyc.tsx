import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, ShieldCheck, Upload, XCircle } from 'lucide-react';

import { Alert, PageLoader, StatusBadge } from '@/components/ui';
import { dateTime } from '@/lib/format';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { ID_DOC_TYPES, KYC_DOC_TYPES, PROOF_TYPES, kycFor, uploadKyc } from '@/lib/store';
import type { KycDoc, ProofType } from '@/lib/types';

/**
 * Identity verification, on its own page.
 *
 * It used to be a panel wedged between personal details and the password form
 * on the profile screen, which put a five-document review queue in the same
 * breath as changing a phone number. It is its own step in opening an account,
 * so it gets its own page — and enough room to say, per document, what the
 * desk is holding and what is still needed.
 */
export default function KycPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { refreshUser } = useAuth();

  const [docs, setDocs] = useState<KycDoc[]>([]);
  const [pending, setPending] = useState<Record<string, File | null>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [proofType, setProofType] = useState<ProofType>('aadhaar');

  const load = useCallback(() => {
    if (user) setDocs(kycFor(user.id));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (authLoading || !user) return <PageLoader label="Loading your verification" />;

  // The newest upload per type is the one that counts — re-uploading after a
  // rejection must not leave the old verdict on screen.
  const latest = (docType: string) => docs.find((d) => d.doc_type === docType);

  const approved = KYC_DOC_TYPES.filter((t) => latest(t.value)?.status === 'approved').length;
  const rejected = KYC_DOC_TYPES.filter((t) => latest(t.value)?.status === 'rejected').length;
  const missing = KYC_DOC_TYPES.filter((t) => !latest(t.value)).length;

  function submit(docType: string) {
    const file = pending[docType];
    if (!file) {
      setError('Choose a file first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // The file itself is not kept — only its name, so the admin queue has
      // something to show. Base64 blobs would exhaust localStorage quickly.
      uploadKyc(user!.id, docType, file.name, proofType);
      setPending((p) => ({ ...p, [docType]: null }));
      load();
      refreshUser();
      setNotice('Document uploaded and queued for review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the document.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <ShieldCheck size={22} className="text-accent" /> Identity verification
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          The five documents your account was opened with, and where each one has got to.
        </p>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-5"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

      {/* ── Where the account stands ─────────────────────────────────── */}
      <section className="card mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-text-dim">Account status</p>
            <p className="mt-1 flex items-center gap-2.5 text-lg font-semibold">
              <StatusBadge status={user.kyc_status} />
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Tally icon={<CheckCircle2 size={15} />} tone="text-success" label="Approved" value={approved} />
            <Tally icon={<Clock size={15} />} tone="text-warn" label="In review" value={KYC_DOC_TYPES.length - approved - rejected - missing} />
            <Tally icon={<XCircle size={15} />} tone="text-danger" label="Rejected" value={rejected} />
          </div>
        </div>

        {/* One bar, five segments — the same shape as the list below it. */}
        <div className="mt-4 flex gap-1.5" aria-hidden>
          {KYC_DOC_TYPES.map((t) => {
            const status = latest(t.value)?.status;
            return (
              <span
                key={t.value}
                className={`h-1.5 flex-1 rounded-full ${
                  status === 'approved'
                    ? 'bg-success'
                    : status === 'rejected'
                      ? 'bg-danger'
                      : status
                        ? 'bg-warn/70'
                        : 'bg-border'
                }`}
              />
            );
          })}
        </div>

        <p className="mt-3 text-sm text-text-muted">
          {missing === KYC_DOC_TYPES.length
            ? 'No documents on file yet. Upload them below and the desk will review each one.'
            : user.kyc_status === 'approved' && missing === 0
            ? 'Every document has been approved. Nothing further is needed.'
            : rejected > 0
              ? 'One or more documents were not accepted. Re-upload them below and the desk will look again.'
              : 'Your documents are with our verification desk. Each one is reviewed on its own.'}
        </p>
      </section>

      {/* ── The five documents ───────────────────────────────────────── */}
      <div className="mt-6 space-y-3">
        {KYC_DOC_TYPES.map((type) => {
          const doc = latest(type.value);
          const needsUpload = !doc || doc.status === 'rejected';
          return (
            <section key={type.value} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{type.label}</h2>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {doc
                      ? <>{doc.file_name} · uploaded {dateTime(doc.created_at)}
                          {doc.reviewed_at && <> · reviewed {dateTime(doc.reviewed_at)}</>}</>
                      : 'Not uploaded yet.'}
                  </p>
                  {doc?.rejection_reason && (
                    <p className="mt-1.5 text-xs text-danger">Reason: {doc.rejection_reason}</p>
                  )}
                </div>
                {doc ? <StatusBadge status={doc.status} /> : <span className="badge border border-border text-text-dim">missing</span>}
              </div>

              {needsUpload && (
                <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-border pt-4">
                  {ID_DOC_TYPES.includes(type.value) && (
                    <div className="min-w-[160px]">
                      <label className="label" htmlFor={`proof_${type.value}`}>
                        Which ID
                      </label>
                      <select
                        id={`proof_${type.value}`}
                        value={proofType}
                        onChange={(e) => setProofType(e.target.value as ProofType)}
                        className="input"
                      >
                        {PROOF_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="min-w-[220px] flex-1">
                    <label className="label" htmlFor={`file_${type.value}`}>
                      {doc ? 'Replace this document' : 'Upload this document'}
                    </label>
                    <input
                      id={`file_${type.value}`}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) =>
                        setPending((p) => ({ ...p, [type.value]: e.target.files?.[0] ?? null }))
                      }
                      className="input file:mr-3 file:rounded file:border-0 file:bg-bg-elevated file:px-2 file:py-1 file:text-xs file:text-text"
                    />
                  </div>
                  <button
                    onClick={() => submit(type.value)}
                    disabled={saving || !pending[type.value]}
                    className="btn-primary"
                  >
                    <Upload size={15} /> Upload
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-text-dim">
        Only the file name is stored in this demo — there is no server here to
        hold the bytes.
      </p>
    </div>
  );
}

function Tally({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: number;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={tone}>{icon}</span>
      <span className="tabular-nums font-semibold">{value}</span>
      <span className="text-text-muted">{label}</span>
    </span>
  );
}
