'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Coins, TrendingUp, Users } from 'lucide-react';

import { num } from '@/lib/api';
import type { RoiPlan } from '@/types';

/**
 * The hero visual: the card render floating in a 3D scene with live data
 * panels layered around it.
 *
 * The scene follows the pointer when there is one, and otherwise holds a fixed
 * three-quarter view so the depth still reads on touch and in screenshots.
 */
export default function HeroScene({ plan }: { plan: RoiPlan | null }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setInteractive(fine.matches && !calm.matches);
    sync();
    fine.addEventListener('change', sync);
    calm.addEventListener('change', sync);
    return () => {
      fine.removeEventListener('change', sync);
      calm.removeEventListener('change', sync);
    };
  }, []);

  // Tracked across the whole viewport — the stack should acknowledge the
  // cursor before it arrives over the card.
  useEffect(() => {
    if (!interactive) return;
    const node = ref.current;
    if (!node) return;

    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const px = event.clientX / window.innerWidth - 0.5;
        const py = event.clientY / window.innerHeight - 0.5;
        node.style.setProperty('--scene-y', `${(px * 15).toFixed(2)}deg`);
        node.style.setProperty('--scene-x', `${(-py * 9).toFixed(2)}deg`);
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame.current);
    };
  }, [interactive]);

  // Best single month across the published plans — the headline number worth
  // putting next to the card.
  const peakMonthly = plan
    ? plan.months.reduce((m, r) => Math.max(m, Number(r.percent)), 0)
    : 0;

  return (
    <div className="perspective-lg relative mx-auto w-full max-w-[600px] px-4 py-10 sm:px-6" aria-hidden>
      <div
        ref={ref}
        className="preserve-3d relative flex flex-col gap-5"
        style={{
          transform: 'rotateX(var(--scene-x, 4deg)) rotateY(var(--scene-y, -9deg))',
          transition: 'transform 300ms cubic-bezier(.22,1,.36,1)',
        }}
      >
        {/* The panels are laid out in the FLOW, above and below the card,
            rather than absolutely positioned over it.

            Absolute corners kept colliding with the artwork no matter how much
            padding the scene had, and for two reasons at once: the card render
            fills the content box, and `translateZ` under the scene's yaw drags
            each panel toward the vanishing point — off the coordinates the CSS
            asked for. Flow layout cannot overlap, and the depths still do their
            job because they only ever move a panel along Z. */}

        {/* Warm pool of light beneath, so the card sits ON something. */}
        <div
          className="pointer-events-none absolute inset-x-10 bottom-16 h-24 rounded-[50%] blur-3xl"
          style={{
            transform: 'translateZ(-90px)',
            background: 'radial-gradient(ellipse, rgba(217,166,46,.45), transparent 70%)',
          }}
        />

        {/* ── Network, above and to the right ───────────────────────── */}
        <Floating className="relative z-10 ml-auto w-48" depth={-35} delay="-3s" slow>
          <div className="panel rounded-2xl p-4">
            <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-text-dim">
              <Users size={11} /> Your network
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-text">₹24,600</p>
            <div className="mt-3 space-y-1.5">
              {[
                ['L1', 'w-full', 'bg-accent'],
                ['L2', 'w-2/3', 'bg-bronze'],
                ['L3', 'w-1/3', 'bg-gold'],
              ].map(([label, width, color]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-5 text-[9px] text-text-dim">{label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <span className={`block h-full rounded-full ${width} ${color}`} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Floating>

        {/* ── The card ──────────────────────────────────────────────────
            Two sources, not one: the pair render is a wide 3:2 that shrinks to
            nothing in a phone-width column, so narrow viewports get the
            upright render instead. */}
        <div className="relative -my-2 animate-float" style={{ animationDuration: '9s' }}>
          <picture>
            <source media="(min-width: 640px)" srcSet="/images/cards/card-pair.webp" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/cards/card-upright.webp"
              alt=""
              width={1400}
              height={933}
              className="mx-auto w-full max-w-[280px] drop-shadow-[0_40px_70px_rgba(0,0,0,.8)] sm:max-w-none"
              // The largest paint on the page — never lazy, always first.
              loading="eager"
              decoding="async"
            />
          </picture>
        </div>

        {/* ── Payout and rate, below the card ───────────────────────── */}
        <div className="relative z-20 flex items-stretch justify-between gap-4">
          <Floating className="w-44" depth={70} delay="-1.5s">
            <div className="panel h-full rounded-2xl p-4">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-text-dim">
                <Coins size={11} /> This month
              </p>
              <p className="mt-1.5 text-2xl font-semibold tabular-nums text-success">+₹750</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-success">
                <TrendingUp size={11} /> credited on time
              </p>
            </div>
          </Floating>

          {peakMonthly > 0 && (
            <Floating className="shrink-0" depth={60} delay="-4s" slow>
              <div className="border-gradient-gold h-full rounded-2xl px-4 py-3 text-center shadow-e3">
                <p className="text-[9px] uppercase tracking-[0.16em] text-text-dim">Up to</p>
                <p className="text-xl font-semibold tabular-nums text-gradient-gold">
                  {num(peakMonthly, 2)}%
                </p>
                <p className="text-[10px] text-text-muted">a month</p>
              </div>
            </Floating>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Positions a panel at a fixed depth and bobs it gently.
 *
 * The two jobs are split across two elements on purpose: the float keyframes
 * animate `transform`, which would otherwise overwrite the `translateZ` that
 * places the panel in the scene — collapsing the whole stack to one plane.
 */
function Floating({
  children,
  className = '',
  depth,
  delay,
  slow,
}: {
  children: ReactNode;
  className?: string;
  depth: number;
  delay: string;
  slow?: boolean;
}) {
  return (
    <div className={`preserve-3d ${className}`} style={{ transform: `translateZ(${depth}px)` }}>
      <div className={slow ? 'animate-float-slow' : 'animate-float'} style={{ animationDelay: delay }}>
        {children}
      </div>
    </div>
  );
}
