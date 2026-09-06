'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';

import AuthLayout from '@/components/AuthLayout';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Alert, Spinner } from '@/components/ui';

function LoginForm() {
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) router.replace(next);
  }, [authLoading, user, router, next]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      router.push(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed. Please try again.');
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
          <Link href="/register" className="font-medium text-accent hover:underline">
            Open one
          </Link>
        </>
      }
    >
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
