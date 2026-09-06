import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';

import Logo from '@/components/Logo';
import { Alert, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { ADMIN } from '@/lib/seed';

export default function AdminLogin() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user?.is_staff) navigate('/admin', { replace: true });
  }, [loading, user, navigate]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const found = login(email, password);
      if (!found.is_staff) {
        setError('That account is not a staff account.');
        return;
      }
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="border-gradient rounded-3xl p-7 shadow-e4 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <Logo className="h-11" priority />
            <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-text-dim">
              Admin panel · staff access only
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            {error && <Alert kind="error">{error}</Alert>}

            <div>
              <label className="label" htmlFor="a-email">Email</label>
              <div className="relative">
                <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
                <input
                  id="a-email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="a-password">Password</label>
              <div className="relative">
                <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
                <input
                  id="a-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full py-3.5">
              {submitting ? <Spinner className="h-4 w-4" /> : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>
        </div>

        {/* A demo with hidden credentials is a demo nobody can open. */}
        <button
          type="button"
          onClick={() => {
            setEmail(ADMIN.email);
            setPassword(ADMIN.password);
          }}
          className="card mt-4 flex w-full items-start gap-3 p-4 text-left transition hover:border-accent/40"
        >
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" />
          <span className="text-xs leading-relaxed text-text-muted">
            <strong className="text-text">Demo account</strong> — click to fill.
            <br />
            <span className="font-mono text-[11px] text-accent">{ADMIN.email}</span>
            {' · '}
            <span className="font-mono text-[11px] text-accent">{ADMIN.password}</span>
          </span>
        </button>
      </div>
    </div>
  );
}
