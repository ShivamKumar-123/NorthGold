'use client';

import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import Tilt from './Tilt';

export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-accent ${className}`} aria-hidden />;
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[46vh] flex-col items-center justify-center gap-4 text-text-muted">
      {/* Two counter-rotating rings read as a spinning object rather than a
          flat spinner. */}
      <span className="perspective relative grid h-14 w-14 place-items-center">
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent border-r-accent/40" />
        <span
          className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-b-bronze border-l-bronze/40"
          style={{ animationDirection: 'reverse', animationDuration: '1.4s' }}
        />
        <span className="h-2 w-2 rounded-full bg-accent shadow-glow" />
      </span>
      <span className="text-sm">{label}…</span>
    </div>
  );
}

export function Alert({
  kind = 'info',
  children,
  onDismiss,
}: {
  kind?: 'info' | 'success' | 'error' | 'warn';
  children: ReactNode;
  onDismiss?: () => void;
}) {
  const styles = {
    info: 'border-accent/35 bg-accent/[0.09] text-accent',
    success: 'border-success/35 bg-success-soft text-success',
    error: 'border-danger/35 bg-danger-soft text-danger',
    warn: 'border-warn/35 bg-warn-soft text-warn',
  }[kind];
  const Icon = { info: Info, success: CheckCircle2, error: AlertCircle, warn: AlertCircle }[kind];

  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3.5 text-sm shadow-e1 ${styles}`}
      role="alert"
    >
      <Icon size={17} className="mt-px shrink-0" aria-hidden />
      <div className="flex-1 leading-relaxed">{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="shrink-0 rounded opacity-70 transition hover:opacity-100"
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

const TONE_STYLES = {
  default: { text: 'text-text', glow: 'rgba(232,232,229,.28)', ring: 'border-border' },
  success: { text: 'text-success', glow: 'rgba(34,197,94,.45)', ring: 'border-success/25' },
  accent: { text: 'text-accent', glow: 'rgba(77,124,254,.5)', ring: 'border-accent/25' },
  gold: { text: 'text-gradient-gold', glow: 'rgba(224,177,85,.45)', ring: 'border-gold/25' },
  bronze: { text: 'text-bronze', glow: 'rgba(184,115,51,.45)', ring: 'border-bronze/25' },
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof TONE_STYLES;
}) {
  const style = TONE_STYLES[tone];

  return (
    <Tilt max={6} lift={10} className="h-full">
      <div className="card preserve-3d group h-full overflow-hidden p-5 transition-shadow duration-300 hover:shadow-e3">
        {/* Corner light that blooms on hover. */}
        <span
          className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: style.glow }}
          aria-hidden
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 layer-1">
            <p className="text-[11px] uppercase tracking-[0.12em] text-text-muted">{label}</p>
            <p className={`mt-2 truncate text-[27px] font-semibold leading-tight tracking-tight ${style.text}`}>
              {value}
            </p>
            {hint && <p className="mt-1.5 text-xs text-text-dim">{hint}</p>}
          </div>
          {icon && (
            <div
              className={`layer-2 shrink-0 rounded-xl border bg-white/[0.04] p-2.5 text-text-muted shadow-e1 ${style.ring}`}
            >
              {icon}
            </div>
          )}
        </div>
      </div>
    </Tilt>
  );
}

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-success-soft text-success border border-success/25',
  paid: 'bg-success-soft text-success border border-success/25',
  active: 'bg-success-soft text-success border border-success/25',
  pending: 'bg-warn-soft text-warn border border-warn/25',
  submitted: 'bg-warn-soft text-warn border border-warn/25',
  rejected: 'bg-danger-soft text-danger border border-danger/25',
  blocked: 'bg-danger-soft text-danger border border-danger/25',
  suspended: 'bg-danger-soft text-danger border border-danger/25',
  failed: 'bg-danger-soft text-danger border border-danger/25',
  skipped: 'bg-white/5 text-text-muted border border-border',
  matured: 'bg-accent/12 text-accent border border-accent/25',
  cancelled: 'bg-white/5 text-text-muted border border-border',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status?.toLowerCase()] ?? 'bg-white/5 text-text-muted border border-border';
  return <span className={`badge ${style}`}>{status?.replace(/_/g, ' ') || '—'}</span>;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
      {icon && (
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-white/[0.03] text-text-dim shadow-e1">
          {icon}
        </div>
      )}
      <div>
        <p className="font-medium text-text">{title}</p>
        {description && <p className="mt-1.5 max-w-sm text-sm text-text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  // Escape closes, and the page behind must not scroll while a dialog is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="perspective fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md">
      <div
        className={`glass my-8 w-full rounded-3xl ${width}`}
        role="dialog"
        aria-modal="true"
        // Enters by rotating up from below — the dialog arrives in the scene
        // rather than appearing flat on top of it.
        style={{ animation: 'modal-in 340ms cubic-bezier(.22,1,.36,1) both' }}
      >
        <style>{`@keyframes modal-in{from{opacity:0;transform:translateY(26px) rotateX(-9deg) scale(.97)}to{opacity:1;transform:none}}`}</style>
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <h2 className="text-base font-semibold text-text">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted transition hover:bg-white/5 hover:text-text"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.07] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  required,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-text-dim">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

export function Sparkline({
  values,
  className = 'h-10 w-full',
  up,
}: {
  values: number[];
  className?: string;
  up?: boolean;
}) {
  if (values.length < 2) return <div className={className} />;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100;
    const y = 100 - ((v - min) / span) * 100;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const stroke = up === undefined ? '#D9A62E' : up ? '#22c55e' : '#f43f5e';
  const id = `spark-${up === undefined ? 'n' : up ? 'u' : 'd'}`;

  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${points.join(' ')} 100,100`} fill={`url(#${id})`} />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
