'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Gift, ShieldCheck } from 'lucide-react';

import AuthLayout from '@/components/AuthLayout';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { KYC_DOC_TYPES, PROOF_TYPES, type ProofType } from '@/lib/kyc';
import { Alert, Spinner } from '@/components/ui';

/**
 * Signup, in two steps: who you are, then proof of it.
 *
 * The documents are not optional and there is no "do this later" — the API
 * refuses a registration that is missing any of the five — so the queue an
 * administrator works from is never empty for a member who is already able to
 * deposit.
 */
function RegisterForm() {
  const { register, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();

  const [step, setStep] = useState<1 | 2>(1);
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
  const [documents, setDocuments] = useState<Record<string, File>>({});
  const [proofType, setProofType] = useState<ProofType>('aadhaar');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // A referral link lands here as /register?ref=CODE. Prefill it and lock the
  // field, so the sponsor attribution cannot be lost by an accidental edit.
  const refFromLink = params.get('ref') || '';
  useEffect(() => {
    if (refFromLink) setForm((f) => ({ ...f, referral_code: refFromLink.toUpperCase() }));
  }, [refFromLink]);

  useEffect(() => {
    if (!authLoading && user) router.replace('/dashboard');
  }, [authLoading, user, router]);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const attached = KYC_DOC_TYPES.filter((d) => documents[d.value]).length;
  const allAttached = attached === KYC_DOC_TYPES.length;

  function onContinue(e: React.FormEvent) {
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
    setStep(2);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!allAttached) {
      setError('Attach all five documents to open your account.');
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
        proofType,
        documents,
      });
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Registration failed. Please try again.';
      setError(message);
      // A rejected email or password is a step-one problem, and leaving
      // someone staring at five file pickers gives them nothing to fix. Only
      // send them back when the complaint is not about the documents.
      if (!KYC_DOC_TYPES.some((d) => message.startsWith(d.value))) setStep(1);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Create account"
      title={<>Open your account</>}
      subtitle={
        step === 1
          ? 'Two short steps: your details, then your identity documents.'
          : 'Last step. These go straight to our verification desk.'
      }
      bullets={[
        'No minimum to get started',
        'Your return schedule is fixed at the moment you invest',
        'Earn on everyone you refer, and on their referrals too',
      ]}
      footer={
        <>
          Already registered?{' '}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <StepRail step={step} />

        {refFromLink && (
          <Alert kind="success">
              <span className="flex items-center gap-1.5">
                <Gift size={14} />
                You were referred with code <strong className="font-mono">{refFromLink.toUpperCase()}</strong>.
                You will join their network.
              </span>
          </Alert>
        )}

        {step === 1 ? (
          <form onSubmit={onContinue} className="space-y-4">
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

            <button type="submit" data-auth="field" className="btn-primary w-full py-3.5">
              Continue <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <Alert kind="error">{error}</Alert>}

            <div className="rounded-2xl border border-border bg-bg-card/60 p-4" data-auth="field">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck size={16} className="text-accent" /> Identity verification
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                All five are required. An administrator reviews each one, and
                your account shows as verified once they have all been approved.
              </p>
            </div>

            <div data-auth="field">
              <label className="label" htmlFor="proof_type">
                Which ID are you uploading? <span className="text-danger">*</span>
              </label>
              <select
                id="proof_type"
                value={proofType}
                onChange={(e) => setProofType(e.target.value as ProofType)}
                className="input"
              >
                {PROOF_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-text-dim">
                Applies to the front and back below. Photograph both sides of
                the same document.
              </p>
            </div>

            <div className="space-y-3">
              {KYC_DOC_TYPES.map((doc) => (
                <div key={doc.value} data-auth="field">
                  <label className="label flex items-center gap-1.5" htmlFor={`doc_${doc.value}`}>
                    {doc.label} <span className="text-danger">*</span>
                    {documents[doc.value] && <Check size={13} className="text-success" />}
                  </label>
                  <input
                    id={`doc_${doc.value}`}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) =>
                      setDocuments((d) => {
                        const file = e.target.files?.[0];
                        if (!file) {
                          const { [doc.value]: _dropped, ...rest } = d;
                          return rest;
                        }
                        return { ...d, [doc.value]: file };
                      })
                    }
                    className="input file:mr-3 file:rounded file:border-0 file:bg-bg-elevated file:px-2 file:py-1 file:text-xs file:text-text"
                  />
                </div>
              ))}
            </div>

            <p className="text-xs text-text-dim">
              {attached} of {KYC_DOC_TYPES.length} attached. JPEG, PNG, WebP or
              PDF, up to 5 MB each.
            </p>

            <div className="flex gap-3" data-auth="field">
              <button
                type="button"
                onClick={() => { setError(''); setStep(1); }}
                className="btn-ghost px-5 py-3.5"
              >
                <ArrowLeft size={16} /> Back
              </button>
              <button
                type="submit"
                disabled={submitting || !allAttached}
                className="btn-primary flex-1 py-3.5"
              >
                {submitting ? <Spinner className="h-4 w-4" /> : <>Create account <ArrowRight size={16} /></>}
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}

/** Two dots and a rule. Enough to say "there is a second step" without turning
 *  a short form into a wizard. */
function StepRail({ step }: { step: 1 | 2 }) {
  const steps = [
    { n: 1 as const, label: 'Your details' },
    { n: 2 as const, label: 'Identity' },
  ];
  return (
    <ol className="flex items-center gap-3 text-xs">
      {steps.map((s, i) => (
        <li key={s.n} className="flex flex-1 items-center gap-2">
          <span
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold ${
              step >= s.n
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-border text-text-dim'
            }`}
          >
            {step > s.n ? <Check size={12} /> : s.n}
          </span>
          <span className={step >= s.n ? 'font-medium text-text' : 'text-text-dim'}>{s.label}</span>
          {i === 0 && <span className="h-px flex-1 bg-border" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
