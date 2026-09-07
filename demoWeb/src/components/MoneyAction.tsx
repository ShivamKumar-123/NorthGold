import type { ReactNode } from 'react';
import { ArrowRight, Lock } from 'lucide-react';

/**
 * One of the two things you can do with money that is already on the platform.
 *
 * Deposit sits in the page header because it brings money in from outside.
 * These two move money that is already here, so they sit directly under the
 * figures they act on — and each states the balance it would draw from, which
 * is the number people actually want when they ask "why can't I withdraw?".
 *
 * When there is nothing available the card does not simply grey out: it says
 * where the money went instead. A disabled control with no explanation is the
 * thing that generates the support message.
 */
export default function MoneyAction({
  icon,
  title,
  body,
  amountLabel,
  amount,
  cta,
  disabled = false,
  disabledHint,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  amountLabel: string;
  amount: string;
  cta: string;
  disabled?: boolean;
  disabledHint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="card group flex h-full w-full flex-col gap-3 p-5 text-left transition-all duration-200
                 enabled:hover:-translate-y-0.5 enabled:hover:border-accent/45 enabled:hover:shadow-e3
                 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${
            disabled
              ? 'border-border bg-white/[0.03] text-text-dim'
              : 'border-accent/35 bg-accent/10 text-accent'
          }`}
        >
          {disabled ? <Lock size={15} /> : icon}
        </span>
        <span className="font-semibold">{title}</span>
        {!disabled && (
          <ArrowRight
            size={15}
            className="ml-auto text-text-dim transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-accent"
          />
        )}
      </div>

      <p className="text-sm leading-relaxed text-text-muted">{body}</p>

      <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border pt-3">
        <span className="text-xs uppercase tracking-wide text-text-dim">{amountLabel}</span>
        <span className={`tabular-nums font-semibold ${disabled ? 'text-text-muted' : 'text-success'}`}>
          {amount}
        </span>
      </div>

      <p className={`text-xs ${disabled ? 'text-warn' : 'text-accent'}`}>
        {disabled ? disabledHint : cta}
      </p>
    </button>
  );
}
