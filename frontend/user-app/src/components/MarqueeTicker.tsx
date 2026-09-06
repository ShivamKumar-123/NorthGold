'use client';

import { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';
import { Radio, TrendingDown, TrendingUp } from 'lucide-react';

import { useLivePrices } from '@/hooks/useLivePrices';
import { num } from '@/lib/api';
import type { Instrument } from '@/types';

/**
 * The rolling price strip under the hero.
 *
 * Small cards rather than a run of bare text: a plain ticker line reads as
 * chrome and gets skipped, while a card gives each instrument a shape the eye
 * can land on mid-scroll.
 *
 * Driven by GSAP rather than a CSS keyframe. The old `animate-marquee` moved a
 * fixed -50%, which only lines up if both copies are exactly the same width —
 * true for text, not for cards whose width depends on the instrument name. A
 * tween to the measured width of one copy is correct whatever they render as,
 * and it can also be paused on hover and reversed for direction without
 * re-authoring keyframes.
 */
export default function MarqueeTicker({ instruments }: { instruments: Instrument[] }) {
  const symbols = useMemo(() => instruments.map((i) => i.symbol), [instruments]);
  const { prices, connected } = useLivePrices(symbols);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  // Two identical copies: the second takes over the frame exactly as the first
  // leaves it, so the loop has no gap.
  const items = instruments.length ? instruments : [];

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !items.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      // Measure ONE copy. `scrollWidth / 2` would be wrong the moment the two
      // halves differ by a sub-pixel rounding.
      const first = track.querySelector<HTMLElement>('[data-copy="0"]');
      if (!first) return;

      const loop = () => {
        const distance = first.getBoundingClientRect().width;
        if (!distance) return;
        tweenRef.current?.kill();
        gsap.set(track, { x: 0 });
        tweenRef.current = gsap.to(track, {
          x: -distance,
          duration: distance / 44, // ~44px per second, regardless of how many
          ease: 'none',
          repeat: -1,
        });
      };

      loop();
      // Fonts and images settle after first paint and change the width.
      const ro = new ResizeObserver(loop);
      ro.observe(first);
      return () => ro.disconnect();
    }, track);

    return () => {
      tweenRef.current?.kill();
      ctx.revert();
    };
  }, [items.length]);

  if (!items.length) return null;

  const live = connected;

  return (
    <div className="relative border-y border-border bg-bg-sunken/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-4 sm:px-6">
        <span
          className={`hidden shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px]
                      font-semibold uppercase tracking-[0.16em] sm:inline-flex ${
                        live
                          ? 'border-success/35 bg-success-soft text-success'
                          : 'border-border bg-white/[0.03] text-text-dim'
                      }`}
        >
          <Radio size={11} />
          {live ? 'Live' : 'Delayed'}
        </span>

        <div
          className="fade-x relative flex-1 overflow-hidden"
          onMouseEnter={() => tweenRef.current?.pause()}
          onMouseLeave={() => tweenRef.current?.resume()}
        >
          <div ref={trackRef} className="flex w-max items-stretch">
            {[0, 1].map((copy) => (
              <div key={copy} data-copy={copy} className="flex items-stretch gap-3 pr-3" aria-hidden={copy === 1}>
                {items.map((instrument) => {
                  const tick = prices[instrument.symbol];
                  const price = tick?.price ?? Number(instrument.current_price);
                  const change = tick?.change_percent ?? Number(instrument.change_percent);
                  const up = change >= 0;

                  return (
                    <article
                      key={`${copy}-${instrument.id}`}
                      className="group flex w-[212px] shrink-0 flex-col justify-between rounded-xl
                                 border border-border bg-bg-card/70 px-3.5 py-3 shadow-e1
                                 transition-colors duration-300 hover:border-accent/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] font-semibold tracking-wider text-accent">
                          {instrument.symbol}
                        </span>
                        <span
                          className={`flex items-center gap-0.5 text-[10px] font-medium tabular-nums ${
                            up ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {up ? '+' : ''}
                          {change.toFixed(2)}%
                        </span>
                      </div>

                      <p className="mt-1.5 truncate text-[11px] leading-tight text-text-dim">
                        {instrument.issuer_name || 'Unlisted issuer'}
                      </p>

                      <div className="mt-2 flex items-end justify-between gap-2">
                        <span className="text-lg font-semibold tabular-nums tracking-tight text-text">
                          {num(price, 2)}
                        </span>
                        <span className="text-[10px] tabular-nums text-gold">
                          {num(instrument.interest_rate, 2)}% p.a.
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
