import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

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
  accent: { text: 'text-accent', glow: 'rgba(217,166,46,.5)', ring: 'border-accent/25' },
  gold: { text: 'text-gradient-gold', glow: 'rgba(217,166,46,.45)', ring: 'border-gold/25' },
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
      <div className="card tex-card preserve-3d group h-full overflow-hidden p-5 transition-shadow duration-300 hover:shadow-e3">
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

/**
 * Keyframes for the dialog.
 *
 * Inlined with the component so a modal carries its own motion wherever it is
 * mounted, rather than depending on a global sheet that each app would have to
 * remember to keep in step. The reduced-motion block flattens every transform
 * to a plain fade — the dialog still announces itself, it just stops flying.
 */
const MODAL_MOTION = `
@keyframes ng-veil-in { from { opacity: 0 } to { opacity: 1 } }
@keyframes ng-veil-out { from { opacity: 1 } to { opacity: 0 } }
@keyframes ng-dialog-in {
  0%   { opacity: 0; transform: translateY(30px) scale(.94) rotateX(-9deg) }
  55%  { opacity: 1 }
  100% { opacity: 1; transform: none }
}
@keyframes ng-dialog-out {
  from { opacity: 1; transform: none }
  to   { opacity: 0; transform: translateY(12px) scale(.975) }
}
@keyframes ng-sheen { from { transform: translateX(-130%) } to { transform: translateX(240%) } }
@media (prefers-reduced-motion: reduce) {
  @keyframes ng-dialog-in { from { opacity: 0 } to { opacity: 1 } }
  @keyframes ng-dialog-out { from { opacity: 1 } to { opacity: 0 } }
  @keyframes ng-sheen { from { opacity: 0 } to { opacity: 0 } }
}`;

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
  // The dialog stays mounted for the length of its exit. Unmounting the moment
  // `open` flips makes it vanish mid-gesture, which reads as a crash rather
  // than a dismissal.
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (!mounted) return;
    setLeaving(true);
    const timer = window.setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, 190);
    return () => window.clearTimeout(timer);
  }, [open, mounted]);

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

  if (!mounted) return null;

  return (
    <div
      className="perspective fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
                 bg-black/70 p-4 backdrop-blur-lg"
      style={{ animation: `ng-veil-${leaving ? 'out' : 'in'} 190ms ease both` }}
      // Only a press that both starts and ends on the veil dismisses. Without
      // the target check, releasing a drag that began inside a form would
      // throw the form away.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{MODAL_MOTION}</style>

      <div
        className={`glass relative my-8 w-full overflow-hidden rounded-3xl ring-1 ring-white/10 shadow-e4 ${width}`}
        role="dialog"
        aria-modal="true"
        style={{
          animation: leaving
            ? 'ng-dialog-out 190ms cubic-bezier(.4,0,1,1) both'
            : 'ng-dialog-in 420ms cubic-bezier(.16,1,.3,1) both',
        }}
      >
        {/* Gold hairline along the top edge, with a single sweep across it on
            entry. It is the one flourish — the dialog is usually carrying a
            form about money, and anything busier competes with the fields. */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px
                     bg-gradient-to-r from-transparent via-accent to-transparent"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 opacity-60"
          style={{
            background: 'linear-gradient(100deg, transparent, rgba(217,166,46,.16), transparent)',
            animation: 'ng-sheen 1100ms cubic-bezier(.22,1,.36,1) 120ms both',
          }}
          aria-hidden
        />

        <div className="relative flex items-center justify-between gap-4 border-b border-white/[0.07] px-6 py-4">
          <h2 className="flex items-center gap-2.5 text-base font-semibold text-text">
            <span className="h-4 w-1 rounded-full bg-gradient-to-b from-accent to-accent/30" aria-hidden />
            {title}
          </h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/[0.08]
                       text-text-muted transition-all duration-200 hover:rotate-90 hover:border-accent/40
                       hover:bg-accent/10 hover:text-accent focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-accent/40"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative px-6 py-5">{children}</div>

        {footer && (
          <div className="relative flex flex-wrap justify-end gap-2 border-t border-white/[0.07]
                          bg-white/[0.02] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A confirmation, as a dialog rather than `window.confirm`.
 *
 * The native one cannot be styled, ignores the theme, and lands wherever the
 * browser feels like putting it — in the middle of a gold-and-black admin
 * panel it reads as a page error rather than a question.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  tone = 'danger',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`${tone === 'danger' ? 'btn-danger' : 'btn-primary'} px-4 py-2 text-sm`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-text-muted">{body}</p>
    </Modal>
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
