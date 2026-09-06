import type { ReactNode } from 'react';

import Tilt from './Tilt';

/**
 * A wallet figure dressed as a payment card.
 *
 * Everything is drawn rather than photographed: the product shots on the
 * landing page are 4:3 renders with their own lighting, and cropping one into
 * a 1.586:1 tile would put a picture of a card inside a card. The chip, the
 * contactless arcs and the ridge are built from CSS and inline SVG so they
 * scale with the tile and inherit the accent colour.
 */

const TONES = {
  default: { value: 'text-text', ridge: '#6E6E69', glow: 'rgba(232,232,229,.18)' },
  success: { value: 'text-success', ridge: '#22c55e', glow: 'rgba(34,197,94,.28)' },
  accent: { value: 'text-gold', ridge: '#D9A62E', glow: 'rgba(217,166,46,.32)' },
  danger: { value: 'text-danger', ridge: '#f43f5e', glow: 'rgba(244,63,94,.28)' },
} as const;

export default function BankCard({
  label,
  value,
  hint,
  tone = 'default',
  /** Four digits printed where a card number would sit. Decorative. */
  tag,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof TONES;
  tag?: string;
}) {
  const t = TONES[tone];

  return (
    <Tilt max={9} lift={16} className="h-full">
      {/* `on-dark`: the card face is black in both themes — a payment card
          that turns ivory in light mode stops reading as a card at all. */}
      <div
        className="bank-card on-dark preserve-3d group relative flex h-full flex-col justify-between
                   overflow-hidden rounded-2xl p-5 text-text shadow-e3
                   transition-shadow duration-300 hover:shadow-e4"
      >
        {/* Sweep of light across the face on hover. */}
        <span
          className="pointer-events-none absolute -left-1/3 top-0 h-full w-1/3 -skew-x-12 opacity-0
                     transition-all duration-700 group-hover:left-[110%] group-hover:opacity-100"
          style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.10),transparent)' }}
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0
                     blur-3xl transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: t.glow }}
          aria-hidden
        />

        {/* The ridge line — the mountain from the brand mark, laid across the
            lower half the way a hologram band sits on a real card. */}
        <svg
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 w-full opacity-[0.28]"
          viewBox="0 0 320 120"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id={`bc-${tone}`} x1="0" x2="1">
              <stop offset="0%" stopColor={t.ridge} stopOpacity="0" />
              <stop offset="45%" stopColor={t.ridge} stopOpacity=".9" />
              <stop offset="100%" stopColor={t.ridge} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,104 L64,58 L96,80 L150,26 L196,72 L242,44 L320,96"
            fill="none"
            stroke={`url(#bc-${tone})`}
            strokeWidth="1.5"
          />
          <path
            d="M0,120 L64,74 L96,96 L150,42 L196,88 L242,60 L320,112 L320,120 Z"
            fill={`url(#bc-${tone})`}
            fillOpacity=".14"
          />
        </svg>

        {/* Three bands, the way a real card is laid out: issuer line at the
            top, the number across the middle, the holder line at the foot. */}
        <div className="relative flex items-start justify-between gap-3 layer-1">
          <p className="text-[10px] uppercase tracking-[0.16em] text-text-dim">{label}</p>
          <div className="flex shrink-0 items-center gap-2 layer-2">
            <Chip />
            <Contactless />
          </div>
        </div>

        <div className="relative layer-1">
          <p className={`truncate text-[26px] font-semibold leading-tight tracking-tight ${t.value}`}>
            {value}
          </p>
          <p className="mt-2 font-mono text-[12px] tracking-[0.12em] text-text-muted/90">
            •••• •••• •••• {tag ?? '0000'}
          </p>
        </div>

        <div className="relative flex items-end justify-between gap-3 layer-1">
          {hint ? (
            <p className="min-w-0 truncate text-[11px] text-text-dim">{hint}</p>
          ) : (
            <span />
          )}
              <img
            src="/images/brand/logo-mark.webp"
            alt=""
            width={248}
            height={256}
            loading="lazy"
            decoding="async"
            className="h-8 w-auto shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,.6)]"
            aria-hidden
          />
        </div>
      </div>
    </Tilt>
  );
}

/** EMV contact plate — a gold rectangle with the usual contact divisions. */
function Chip() {
  return (
    <svg width="30" height="23" viewBox="0 0 30 23" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="bc-chip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F5C34A" />
          <stop offset="55%" stopColor="#D9A62E" />
          <stop offset="100%" stopColor="#A87516" />
        </linearGradient>
      </defs>
      <rect x=".6" y=".6" width="28.8" height="21.8" rx="3.4" fill="url(#bc-chip)" />
      <g stroke="rgba(8,8,8,.55)" strokeWidth="1">
        <path d="M0 8h10M0 15h10M30 8H20M30 15H20M10 0v23M20 0v23" />
        <rect x="10" y="8" width="10" height="7" fill="none" />
      </g>
    </svg>
  );
}

/** Contactless arcs, drawn small enough to read as an icon, not a logo. */
function Contactless() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden className="shrink-0 text-text-dim">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M3 5.5a6 6 0 0 1 0 7" />
        <path d="M7 3a10 10 0 0 1 0 12" />
        <path d="M11 .8a14 14 0 0 1 0 16.4" />
      </g>
    </svg>
  );
}
