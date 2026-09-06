import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Gift } from 'lucide-react';

import AuthLayout from '@/components/AuthLayout';
import { useAuth } from '@/lib/auth';
import { Alert, Spinner } from '@/components/ui';

export default function RegisterForm() {
  const { register, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    country: '',
    password: '',
    confirm: '',
    referral_code: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // A referral link lands here as /register?ref=CODE. Prefill it and lock the
  // field, so the sponsor attribution cannot be lost by an accidental edit.
  const refFromLink = params.get('ref') || '';
  useEffect(() => {
    if (refFromLink) setForm((f) => ({ ...f, referral_code: refFromLink.toUpperCase() }));
  }, [refFromLink]);

  useEffect(() => {
    if (!authLoading && user) navigate('/dashboard', { replace: true });
  }, [authLoading, user, navigate]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('The two passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Your password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        country: form.country,
        referral_code: form.referral_code,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Create account"
      title={<>Open your account</>}
      subtitle="It takes a minute. You can deposit as soon as you are in."
      bullets={[
        'No minimum to get started',
        'Your return schedule is fixed at the moment you invest',
        'Earn on everyone you refer, and on their referrals too',
      ]}
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {refFromLink && (
          <Alert kind="success">
              <span className="flex items-center gap-1.5">
                <Gift size={14} />
                You were referred with code <strong className="font-mono">{refFromLink.toUpperCase()}</strong>.
                You will join their network.
              </span>
          </Alert>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Alert kind="error">{error}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2" data-auth="field">
            <div>
              <label className="label" htmlFor="first_name">First name</label>
              <input
                id="first_name"
                value={form.first_name}
                onChange={(e) => set('first_name', e.target.value)}
                className="input"
                placeholder="Priya"
              />
            </div>
            <div>
              <label className="label" htmlFor="last_name">Last name</label>
              <input
                id="last_name"
                value={form.last_name}
                onChange={(e) => set('last_name', e.target.value)}
                className="input"
                placeholder="Sharma"
              />
            </div>
          </div>

          <div data-auth="field">
            <label className="label" htmlFor="email">Email <span className="text-danger">*</span></label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              className="input"
              placeholder="you@example.com"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2" data-auth="field">
            <div>
              <label className="label" htmlFor="phone">Phone</label>
              <input
                id="phone"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                className="input"
                placeholder="+91 98765 43210"
              />
            </div>
            <div>
              <label className="label" htmlFor="country">Country</label>
              <input
                id="country"
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
                className="input"
                placeholder="India"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2" data-auth="field">
            <div>
              <label className="label" htmlFor="password">Password <span className="text-danger">*</span></label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                className="input"
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="label" htmlFor="confirm">Confirm <span className="text-danger">*</span></label>
              <input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                value={form.confirm}
                onChange={(e) => set('confirm', e.target.value)}
                className="input"
                placeholder="Repeat password"
              />
            </div>
          </div>

          <div data-auth="field">
            <label className="label" htmlFor="referral_code">Referral code</label>
            <input
              id="referral_code"
              value={form.referral_code}
              onChange={(e) => set('referral_code', e.target.value.toUpperCase())}
              readOnly={Boolean(refFromLink)}
              className={`input font-mono ${refFromLink ? 'cursor-not-allowed opacity-70' : ''}`}
              placeholder="Optional"
            />
            <p className="mt-1 text-xs text-text-dim">
              Optional. An unknown code is ignored rather than blocking your signup.
            </p>
          </div>

          <button type="submit" disabled={submitting} data-auth="field" className="btn-primary w-full py-3.5">
            {submitting ? <Spinner className="h-4 w-4" /> : <>Create account <ArrowRight size={16} /></>}
          </button>
        </form>
      </div>
    </AuthLayout>
  );
}
