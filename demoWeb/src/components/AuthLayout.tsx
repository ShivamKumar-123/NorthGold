import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Lock, ShieldCheck, Sparkles } from 'lucide-react';

import AuthMotion from '@/components/AuthMotion';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';

/**
 * Standalone shell for sign-in and sign-up.
 *
 * These are their own pages, not marketing pages with a form dropped in: no
 * site header, no footer, no nav links. Everything that could pull someone out
 * of the flow is gone, and the only way off the screen is "back to site" or
 * the other auth page.
 *
 * The form lives in a raised card rather than sitting loose on the background.
 * Loose fields on a dark slab read as an unfinished page; a card gives the
 * form an edge, a shadow and a reason to be where it is — and it anchors the
 * figure, who is pointing at something rather than at empty space.
 */
export default function AuthLayout({
  eyebrow,
  title,
  subtitle,
  bullets,
  footer,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
  /** Reassurance copy for the brand panel — kept short, three at most. */
  bullets: string[];
  /** The "no account yet? / already registered?" cross-link. */
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AuthMotion />

      {/* ── Brand panel ──────────────────────────────────────────────── */}
      <aside className="on-dark relative isolate flex shrink-0 flex-col overflow-hidden border-b border-border bg-[#080808] px-6 py-8 lg:sticky lg:top-0 lg:h-screen lg:w-[44%] lg:max-w-[600px] lg:border-b-0 lg:border-r lg:px-12 lg:py-12">
          <img
          src="/images/bg/hero.webp"
          alt=""
          width={1920}
          height={1080}
          loading="eager"
          decoding="async"
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-90"
        />
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(155deg, rgba(8,8,8,.35) 0%, rgba(8,8,8,.62) 48%, rgba(8,8,8,.94) 100%)',
          }}
          aria-hidden
        />

        <div className="flex items-center justify-between gap-4" data-auth="brand">
          <Link
            to="/"
            className="inline-flex items-center transition-transform duration-300 hover:scale-[1.03]"
          >
            <Logo className="h-10 lg:h-12" priority />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs
                       text-white/70 backdrop-blur transition hover:border-accent/50 hover:text-white"
          >
            <ArrowLeft size={13} /> Back to site
          </Link>
        </div>

        {/* Only the desktop panel carries the pitch — on mobile it would just
            push the form below the fold. */}
        <div className="mt-auto hidden pt-16 lg:block" data-auth="pitch">
          <h2 className="max-w-md text-display-sm font-semibold text-white text-3d">
            Building a <span className="text-gradient-gold">brighter tomorrow</span>
          </h2>
          <p className="mt-4 max-w-sm leading-relaxed text-white/65">
            Fixed-income instruments from partner banks, a contracted monthly
            return, and commission across your whole referral network.
          </p>

          <ul className="mt-8 space-y-3">
            {bullets.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/80">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent/20 text-accent">
                  <Check size={12} />
                </span>
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex items-center gap-6 border-t border-white/10 pt-6">
            <Stat value="12" label="Monthly payouts" />
            <span className="h-8 w-px bg-white/10" aria-hidden />
            <Stat value="5" label="Commission levels" />
            <span className="h-8 w-px bg-white/10" aria-hidden />
            <Stat value="$100" label="Minimum entry" />
          </div>
        </div>
      </aside>

      {/* ── Form side ────────────────────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col overflow-hidden bg-bg">
        {/* Ambient gold wash so the form half is not a flat slab. */}
        <span
          className="pointer-events-none absolute -right-40 -top-40 h-[540px] w-[540px] rounded-full opacity-40 blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(217,166,46,.45), transparent 70%)' }}
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -bottom-48 -left-24 h-[440px] w-[440px] rounded-full opacity-30 blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(184,115,51,.4), transparent 70%)' }}
          aria-hidden
        />
        {/* Faint grid, masked to the centre — it gives the empty space a
            texture without competing with the card. */}
        <div className="grid-overlay opacity-60" aria-hidden />

        <div className="relative flex items-center justify-between gap-4 px-6 pt-6 lg:px-10">
          <span className="chip">
            <ShieldCheck size={12} className="text-gold" />
            Bank-grade handling
          </span>
          <ThemeToggle />
        </div>

        {/* Figure first, form second — she points to the viewer's right in the
            source image, so putting her on the LEFT makes her gesture land on
            the card. Mirroring her instead would reverse the tailoring and put
            her rings on the wrong hand. */}
        <div className="relative flex flex-1 items-center justify-center gap-4 px-5 pb-12 pt-6 sm:px-8 lg:px-10 xl:justify-start xl:gap-8">
          {/* Hidden below `xl`: at narrower widths she would either crowd the
              card or shrink into decoration nobody reads. */}
          <div
            className="pointer-events-none relative hidden flex-1 items-end justify-center self-stretch xl:flex"
            data-auth="figure"
          >
                  <img
              src="/images/people/pointing.webp"
              alt=""
              width={1000}
              height={842}
              loading="lazy"
              decoding="async"
              className="max-h-[62vh] w-auto max-w-full self-center object-contain
                         drop-shadow-[0_30px_60px_rgba(0,0,0,.55)]"
              aria-hidden
            />
          </div>

          {/* The card. `border-gradient` gives it a lit top-left edge that a
              flat 1px border cannot, which is what makes it read as raised. */}
          <div
            className="border-gradient relative w-full max-w-[440px] shrink-0 rounded-3xl p-7 shadow-e4 sm:p-9"
            data-auth="card"
          >
            <span
              className="pointer-events-none absolute -right-px -top-px h-24 w-24 rounded-tr-3xl opacity-70"
              style={{ background: 'radial-gradient(circle at top right, rgba(217,166,46,.35), transparent 70%)' }}
              aria-hidden
            />

            <div className="relative">
              <p className="eyebrow flex items-center gap-1.5">
                <Sparkles size={11} className="text-gold" />
                {eyebrow}
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-[2rem]">{title}</h1>
              <p className="mt-2.5 text-sm leading-relaxed text-text-muted">{subtitle}</p>

              <div className="mt-7">{children}</div>

              <p className="mt-7 text-center text-sm text-text-muted">{footer}</p>

              <p className="mt-6 flex items-center justify-center gap-1.5 border-t border-border pt-5 text-[11px] text-text-dim">
                <Lock size={11} />
                Your details are encrypted in transit and never shared
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-xl font-semibold tabular-nums text-gradient-gold">{value}</p>
      <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-white/45">{label}</p>
    </div>
  );
}
