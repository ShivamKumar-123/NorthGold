'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import { Alert, PageLoader, StatusBadge } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/lib/auth';

export default function ProfilePage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { refreshUser } = useAuth();

  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '', country: '', state: '', city: '', address: '',
  });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm: '' });
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

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    setSaving(true);
    try {
      await api.patch('/auth/me/', form);
      await refreshUser();
      setNotice('Profile updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile.');
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
      await api.post('/auth/change-password/', {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      setPasswords({ current_password: '', new_password: '', confirm: '' });
      setNotice('Password changed.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change your password.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user) return <PageLoader label="Loading your profile" />;

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
        {user.sponsor && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-text-muted">
            Referred by <span className="text-text">{user.sponsor.name}</span>{' '}
            (<span className="font-mono text-accent">{user.sponsor.referral_code}</span>)
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

      {/* Verification lives on its own page now — it is a step in opening
          the account, not a profile field. */}
      <section className="mt-6 card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheck size={17} className="text-accent" /> Identity verification
          </h2>
          <p className="mt-1 text-sm text-text-muted">
            Your documents, their status, and anything the desk still needs.
          </p>
        </div>
        <Link href="/kyc" className="btn-ghost">
          Open verification
        </Link>
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
