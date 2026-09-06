import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';

import AuthLayout from '@/components/AuthLayout';
import { DEMO_PASSWORD, DEMO_PEOPLE } from '@/lib/seed';
import { useAuth } from '@/lib/auth';
import { Alert, Spinner } from '@/components/ui';

export default function LoginForm() {
  const { login, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate(next, { replace: true });
  }, [authLoading, user, navigate, next]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Sign in"
      title={<>Welcome back</>}
      subtitle="Pick up where you left off — your portfolio, payouts and network."
      bullets={[
        'Contracted monthly returns, credited automatically',
        'Cash deposits, verified at the counter',
        'Direct and indirect referral commission',
      ]}
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Open one
          </Link>
        </>
      }
    >
      <button
        type="button"
        onClick={() => {
          setEmail(DEMO_PEOPLE[0].email);
          setPassword(DEMO_PASSWORD);
        }}
        className="mb-5 w-full rounded-xl border border-accent/30 bg-accent/[0.07] p-3 text-left text-xs leading-relaxed text-text-muted transition hover:border-accent/50"
      >
        <strong className="text-text">Demo account</strong> — click to fill.
        <br />
        <span className="font-mono text-[11px] text-accent">{DEMO_PEOPLE[0].email}</span>
        {' · '}
        <span className="font-mono text-[11px] text-accent">{DEMO_PASSWORD}</span>
      </button>

      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Alert kind="error">{error}</Alert>}

        <div data-auth="field">
          <label className="label" htmlFor="email">Email</label>
          <div className="relative">
            <Mail
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim"
            />
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input pl-10"
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div data-auth="field">
          <label className="label" htmlFor="password">Password</label>
          <div className="relative">
            <Lock
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim"
            />
            <input
              id="password"
              type={show ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input px-10"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-text-dim transition hover:text-text"
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={submitting} data-auth="field" className="btn-primary w-full py-3.5">
          {submitting ? <Spinner className="h-4 w-4" /> : <>Sign in <ArrowRight size={16} /></>}
        </button>
      </form>
    </AuthLayout>
  );
}
