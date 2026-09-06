'use client';

import Link from 'next/link';
import { useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BadgeCheck, Banknote, HandCoins } from 'lucide-react';

const POINTS = [
  {
    icon: Banknote,
    title: 'Paid every month',
    body: 'A contracted percentage lands in your wallet on schedule — not at maturity.',
  },
  {
    icon: BadgeCheck,
    title: 'Verified by a person',
    body: 'Cash is handed over at the counter and checked against your own description of it.',
  },
  {
    icon: HandCoins,
    title: 'Earns on your network',
    body: 'Commission runs through the people you introduce, and through theirs.',
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * The card promo band.
 *
 * Framer Motion here rather than GSAP: this block is a self-contained
 * component with its own entrance, and `whileInView` expresses that in one
 * prop without registering a ScrollTrigger the page-level controller would
 * then have to know about. GSAP still owns the page-wide choreography (see
 * LandingMotion), and the two never animate the same element.
 *
 * The animation is ARMED after mount, never during the server render. An
 * `initial={{ opacity: 0 }}` baked into the HTML means the section ships
 * invisible and depends on JavaScript to reveal it — a blocked bundle, a
 * failed hydration or a starved animation frame then hides the whole band. So
 * the server emits it visible and the client hides it a moment before playing
 * it back in.
 *
 * `useLayoutEffect`, not `useEffect`: React flushes layout effects before the
 * browser paints, so the arming re-render is invisible. With `useEffect` the
 * content would appear, vanish, then animate back.
 */
export default function CardPromo() {
  const [armed, setArmed] = useState(false);

  useLayoutEffect(() => {
    // Reduced motion never arms — the section simply stays as rendered.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setArmed(true);
  }, []);

  // Spread onto each element; empty until armed, so the element renders in its
  // natural state with no hidden `initial`.
  const rise = (delay = 0) =>
    armed
      ? {
          initial: { opacity: 0, y: 26 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.4 },
          transition: { duration: 0.7, ease: EASE, delay },
        }
      : {};

  const figure = armed
    ? {
        initial: { opacity: 0, x: 48, scale: 0.96 },
        whileInView: { opacity: 1, x: 0, scale: 1 },
        viewport: { once: true, amount: 0.25 },
        transition: { duration: 1, ease: EASE },
      }
    : {};

  return (
    <section id="card" className="relative isolate overflow-hidden border-b border-border bg-bg">
      {/* Warm pool behind the figure so she is lit by the page, not pasted on. */}
      <div
        className="pointer-events-none absolute right-0 top-1/2 h-[720px] w-[720px] -translate-y-1/2 translate-x-1/4 rounded-full opacity-60 blur-[130px]"
        style={{ background: 'radial-gradient(circle, rgba(217,166,46,.28), transparent 70%)' }}
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-4 lg:py-24">
        {/* ── Copy ─────────────────────────────────────────────────── */}
        <div>
          <motion.p {...rise()} className="eyebrow">
            Your NorthGold card
          </motion.p>

          <motion.h2
            {...rise(0.08)}
            className="mt-3 text-balance text-display-sm font-semibold tracking-tight text-3d"
          >
            One card. Every month, <span className="text-gradient-gold">your money works.</span>
          </motion.h2>

          <motion.p {...rise(0.16)} className="mt-5 max-w-xl leading-relaxed text-text-muted">
            Open an account, hand over your deposit at the counter, and watch a
            fixed schedule pay you back month after month. No trading, no timing
            the market, nothing to watch all day.
          </motion.p>

          <div className="mt-9 space-y-4">
            {POINTS.map(({ icon: Icon, title, body }, i) => (
              <motion.div key={title} {...rise(0.24 + i * 0.09)} className="flex items-start gap-4">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent shadow-e1">
                  <Icon size={17} />
                </span>
                <div>
                  <p className="font-medium text-text">{title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-text-muted">{body}</p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div {...rise(0.55)} className="mt-10 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary px-7 py-3.5 text-base">
              Open an account <ArrowRight size={17} />
            </Link>
            <Link href="/about" className="btn-ghost px-7 py-3.5 text-base">
              How it works
            </Link>
          </motion.div>
        </div>

        {/* ── Figure ───────────────────────────────────────────────────
            She holds the card out toward the copy, so she goes on the right
            and the reading order still ends on the CTA. */}
        <motion.div {...figure} className="relative mx-auto w-full max-w-[460px] lg:max-w-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/people/card-hero.webp"
            alt="A NorthGold member holding out a NorthGold card"
            width={1000}
            height={1094}
            loading="lazy"
            decoding="async"
            className="relative z-10 mx-auto w-full drop-shadow-[0_40px_80px_rgba(0,0,0,.65)]"
          />
          {/* Grounding shadow — without it a cut-out floats. */}
          <span
            className="absolute inset-x-12 bottom-2 h-16 rounded-[50%] blur-2xl"
            style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,.6), transparent 70%)' }}
            aria-hidden
          />
        </motion.div>
      </div>
    </section>
  );
}
