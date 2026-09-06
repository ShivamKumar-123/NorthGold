import { useEffect, useMemo, useRef } from 'react';
import { gsap } from 'gsap';

import { useLivePrices } from '@/hooks/useLivePrices';
import { num } from '@/lib/format';
import type { Instrument } from '@/lib/types';

/**
 * The rolling price strip under the hero.
 *
 * Built as a trading-terminal tape: a brand disc, the symbol, the price and
 * the move, separated by hairlines and running edge to edge. The cards this
 * replaced each opened a box the eye had to enter and leave; a tape is read
 * in one pass, which is the whole point of a strip that never stops moving.
 *
 * Driven by GSAP rather than a CSS keyframe. The old `animate-marquee` moved a
 * fixed -50%, which only lines up if both copies are exactly the same width —
 * true for text, not for rows whose width depends on the instrument name. A
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
          duration: distance / 52, // ~52px per second, regardless of how many
          ease: 'none',
          repeat: -1,
        });
      };

      loop();
      // Fonts settle after first paint and change the width.
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

  return (
    <div className="on-dark relative border-y border-border bg-[#0d0d0f]">
      <div className="flex items-stretch">
        {/* Feed state, kept as part of the tape rather than as a pill beside
            it — it is one more cell on the same rule, so it does not read as
            a separate control. */}
        <span className="flex shrink-0 items-center gap-2 border-r border-border px-4">
          <span className="relative flex h-1.5 w-1.5">
            {connected && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            )}
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                connected ? 'bg-success' : 'bg-text-dim'
              }`}
            />
          </span>
          <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-text-dim sm:inline">
            {connected ? 'Live' : 'Delayed'}
          </span>
        </span>

        <div
          className="relative flex-1 overflow-hidden"
          onMouseEnter={() => tweenRef.current?.pause()}
          onMouseLeave={() => tweenRef.current?.resume()}
        >
          <div ref={trackRef} className="flex w-max items-stretch">
            {[0, 1].map((copy) => (
              <div key={copy} data-copy={copy} className="flex items-stretch" aria-hidden={copy === 1}>
                {items.map((instrument) => {
                  const tick = prices[instrument.symbol];
                  const price = tick?.price ?? Number(instrument.current_price);
                  const percent = tick?.change_percent ?? Number(instrument.change_percent);
                  // The percent is quoted against the opening price, so the
                  // absolute move has to be recovered from it rather than
                  // guessed at — price − price / (1 + pct/100).
                  const moved = price - price / (1 + percent / 100);
                  const up = percent >= 0;
                  const sign = up ? '+' : '−';
                  const tone = percent === 0 ? 'text-text-dim' : up ? 'text-success' : 'text-danger';

                  return (
                    <span
                      key={`${copy}-${instrument.id}`}
                      className="flex shrink-0 items-center gap-2 border-r border-border px-4 py-2.5"
                      title={`${instrument.name} · ${instrument.issuer_name}`}
                    >
                      <Disc instrument={instrument} />
                      <span className="text-[13px] font-semibold tracking-tight text-text">
                        {instrument.symbol}
                      </span>
                      <span className="text-[13px] text-text-faint">•</span>
                      <span className="text-[13px] tabular-nums text-text">{num(price, 2)}</span>
                      <span className={`text-[13px] tabular-nums ${tone}`}>
                        {sign}
                        {num(Math.abs(moved), 2)}
                      </span>
                      <span className={`text-[13px] tabular-nums ${tone}`}>
                        ({sign}
                        {num(Math.abs(percent), 2)}%)
                      </span>
                    </span>
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

/**
 * The brand disc at the head of each row.
 *
 * Real tapes put a logo here. There are no logos to put, so the disc carries
 * the issuer's initial on a colour picked from the issuer name — invented
 * marks would be a worse answer than an honest monogram, and hashing the name
 * keeps one issuer the same colour everywhere it appears.
 */
const DISC_COLOURS = [
  'bg-[#d9a62e] text-black',
  'bg-[#4c8bf5] text-white',
  'bg-[#e07b39] text-black',
  'bg-[#3fae7a] text-black',
  'bg-[#9b7bd4] text-white',
  'bg-[#c9c9c9] text-black',
];

function Disc({ instrument }: { instrument: Instrument }) {
  const key = instrument.issuer_name || instrument.symbol;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const initial = key.trim().charAt(0).toUpperCase() || '?';

  return (
    <span
      className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[11px]
                  font-bold leading-none ${DISC_COLOURS[hash % DISC_COLOURS.length]}`}
      aria-hidden
    >
      {initial}
    </span>
  );
}
