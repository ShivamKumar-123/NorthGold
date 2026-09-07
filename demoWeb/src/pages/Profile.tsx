import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Upload } from 'lucide-react';

import { Alert, PageLoader, StatusBadge } from '@/components/ui';
import { dateTime, displayName } from '@/lib/format';
import { useAuth, useRequireAuth } from '@/lib/auth';
import {
  KYC_DOC_TYPES as DOC_TYPES, changePassword as savePassword, getUser, kycFor,
  updateProfile, uploadKyc,
} from '@/lib/store';
import type { KycDoc } from '@/lib/types';

export default function ProfilePage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { refreshUser } = useAuth();

  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '', country: '', state: '', city: '', address: '',
  });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm: '' });
  const [docs, setDocs] = useState<KycDoc[]>([]);
  const [docType, setDocType] = useState<string>(DOC_TYPES[0].value);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || '', last_name: user.last_name || '',
        phone: user.phone || '', country: user.country || '',
        state: user.state || '', city: user.city || '', address: user.address || '',
      });
    }
  }, [user]);

  const loadKyc = useCallback(() => {
    if (user) setDocs(kycFor(user.id));
  }, [user]);

  useEffect(() => {
    loadKyc();
  }, [loadKyc]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      updateProfile(user!.id, form);
      await refreshUser();
      setNotice('Profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (passwords.new_password !== passwords.confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      savePassword(user!.id, passwords.current_password, passwords.new_password);
      setPasswords({ current_password: '', new_password: '', confirm: '' });
      setNotice('Password changed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change your password.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadDoc(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    setSaving(true);
    try {
      // The file itself is not kept — only its name, so the admin queue has
      // something to show. Base64 blobs would exhaust localStorage quickly.
      uploadKyc(user!.id, docType, file.name);
      setFile(null);
      loadKyc();
      refreshUser();
      setNotice('Document uploaded and queued for review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the document.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user) return <PageLoader label="Loading your profile" />;

  const sponsor = getUser(user.sponsor_id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold">Profile &amp; KYC</h1>
        <p className="mt-1 text-sm text-text-muted">
          Keep your details current — payouts depend on them.
        </p>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-5"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

      <div className="mt-6 card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-text-muted">Signed in as</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <p className="text-xs text-text-dim">Referral code</p>
              <p className="font-mono text-accent">{user.referral_code}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-dim">KYC</p>
              <StatusBadge status={user.kyc_status} />
            </div>
          </div>
        </div>
        {sponsor && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-text-muted">
            Referred by <span className="text-text">{displayName(sponsor)}</span>{' '}
            (<span className="font-mono text-accent">{sponsor.referral_code}</span>)
          </p>
        )}
      </div>

      <section className="mt-6 card p-5">
        <h2 className="font-semibold">Personal details</h2>
        <form onSubmit={saveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input label="First name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} />
          <Input label="Last name" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} />
          <Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Input label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
          <Input label="State / region" value={form.state} onChange={(v) => setForm({ ...form, state: v })} />
          <Input label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
          <div className="sm:col-span-2">
            <label className="label" htmlFor="address">Address</label>
            <textarea
              id="address"
              rows={2}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input resize-none"
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 card p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={17} className="text-accent" /> Identity verification
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Upload each document once. An administrator reviews them individually.
        </p>

        <form onSubmit={uploadDoc} className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label className="label" htmlFor="doc_type">Document type</label>
            <select id="doc_type" value={docType} onChange={(e) => setDocType(e.target.value)} className="input">
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="label" htmlFor="doc_file">File</label>
            <input
              id="doc_file"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="input file:mr-3 file:rounded file:border-0 file:bg-bg-elevated file:px-2 file:py-1 file:text-xs file:text-text"
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            <Upload size={15} /> Upload
          </button>
        </form>

        {docs.length > 0 && (
          <div className="table-wrap mt-5">
            <table className="data">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Uploaded</th>
                  <th>Reviewed</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td>{DOC_TYPES.find((t) => t.value === d.doc_type)?.label ?? d.doc_type}</td>
                    <td className="text-text-muted">{dateTime(d.created_at)}</td>
                    <td className="text-text-muted">{d.reviewed_at ? dateTime(d.reviewed_at) : '—'}</td>
                    <td>
                      <StatusBadge status={d.status} />
                      {d.rejection_reason && (
                        <p className="mt-1 max-w-[240px] whitespace-normal text-xs text-danger">
                          {d.rejection_reason}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 card p-5">
        <h2 className="font-semibold">Change password</h2>
        <form onSubmit={changePassword} className="mt-4 grid gap-4 sm:grid-cols-3">
          <Input
            label="Current password"
            type="password"
            value={passwords.current_password}
            onChange={(v) => setPasswords({ ...passwords, current_password: v })}
          />
          <Input
            label="New password"
            type="password"
            value={passwords.new_password}
            onChange={(v) => setPasswords({ ...passwords, new_password: v })}
          />
          <Input
            label="Confirm new"
            type="password"
            value={passwords.confirm}
            onChange={(v) => setPasswords({ ...passwords, confirm: v })}
          />
          <div className="sm:col-span-3">
            <button type="submit" disabled={saving} className="btn-ghost">
              {saving ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} className="input" />
    </div>
  );
}
