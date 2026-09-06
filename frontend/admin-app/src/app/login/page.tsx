'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import Logo from '@/components/Logo';
import { Alert, Spinner } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function AdminLoginPage() {
  const { login, admin, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && admin) router.replace('/dashboard');
  }, [loading, admin, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-7">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo className="h-9" priority />
          <p className="text-[10px] uppercase tracking-[0.18em] text-text-dim">
            Admin panel · staff access only
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          {error && <Alert kind="error">{error}</Alert>}

          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
            {submitting ? <Spinner className="h-4 w-4" /> : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
