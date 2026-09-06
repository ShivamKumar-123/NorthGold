import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Radio, TrendingDown, TrendingUp } from 'lucide-react';

import { useMarketPrices, type MarketQuote } from '@/hooks/useMarketPrices';

/**
 * The rolling price strip under the hero.
 *
 * Small cards rather than a run of bare text: a plain ticker line reads as
 * chrome and gets skipped, while a card gives each market a shape the eye can
 * land on mid-scroll.
 *
 * What it quotes is real. Crypto streams live from Binance; the currency
 * cards are the ECB's daily reference rates and say `daily` on their face,
 * because a once-a-day number sliding past on a live strip would otherwise
 * read as a tick.
 *
 * Driven by GSAP rather than a CSS keyframe. The old `animate-marquee` moved a
 * fixed -50%, which only lines up if both copies are exactly the same width —
 * true for text, not for cards whose width depends on their content. A tween
 * to the measured width of one copy is correct whatever they render as, and it
 * can also be paused on hover without re-authoring keyframes.
 */
export default function MarqueeTicker() {
  const { quotes, connected } = useMarketPrices();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || !quotes.length) return;
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
      // Fonts settle after first paint and change the width.
      const ro = new ResizeObserver(loop);
      ro.observe(first);
      return () => ro.disconnect();
    }, track);

    return () => {
      tweenRef.current?.kill();
      ctx.revert();
    };
    // Only the count changes the geometry — price updates leave it alone,
    // because the cards are a fixed width.
  }, [quotes.length]);

  // Nothing to show until the first snapshot lands, and nothing to show at all
  // if the market feed cannot be reached. The hero reads fine without it.
  if (!quotes.length) return null;

  return (
    <div className="relative border-y border-border bg-bg-sunken/60 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-4 sm:px-6">
        <span
          className={`hidden shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px]
                      font-semibold uppercase tracking-[0.16em] sm:inline-flex ${
                        connected
                          ? 'border-success/35 bg-success-soft text-success'
                          : 'border-border bg-white/[0.03] text-text-dim'
                      }`}
          title={connected ? 'Streaming live' : 'Reconnecting — refreshed every 15s'}
        >
          <Radio size={11} />
          {connected ? 'Live' : 'Delayed'}
        </span>

        <div
          className="fade-x relative flex-1 overflow-hidden"
          onMouseEnter={() => tweenRef.current?.pause()}
          onMouseLeave={() => tweenRef.current?.resume()}
        >
          <div ref={trackRef} className="flex w-max items-stretch">
            {[0, 1].map((copy) => (
              <div key={copy} data-copy={copy} className="flex items-stretch gap-3 pr-3" aria-hidden={copy === 1}>
                {quotes.map((quote) => (
                  <QuoteCard key={`${copy}-${quote.id}`} quote={quote} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuoteCard({ quote }: { quote: MarketQuote }) {
  const up = quote.percent >= 0;
  const flat = quote.percent === 0;
  const tone = flat ? 'text-text-dim' : up ? 'text-success' : 'text-danger';
  const sign = up ? '+' : '−';

  return (
    <article
      className="group flex w-[212px] shrink-0 flex-col justify-between rounded-xl
                 border border-border bg-bg-card/70 px-3.5 py-3 shadow-e1
                 transition-colors duration-300 hover:border-accent/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: quote.accent }}
            aria-hidden
          />
          <span className="font-mono text-[10px] font-semibold tracking-wider text-accent">
            {quote.label}
          </span>
        </span>
        <span className={`flex items-center gap-0.5 text-[10px] font-medium tabular-nums ${tone}`}>
          {!flat && (up ? <TrendingUp size={10} /> : <TrendingDown size={10} />)}
          {sign}
          {Math.abs(quote.percent).toFixed(2)}%
        </span>
      </div>

      <p className="mt-1.5 flex items-center gap-1.5 truncate text-[11px] leading-tight text-text-dim">
        {quote.name}
        {/* Said on the card itself, not in a footnote nobody reads. */}
        {quote.daily && (
          <span
            className="shrink-0 rounded border border-border px-1 text-[9px] uppercase tracking-wider text-text-faint"
            title="European Central Bank reference rate, published once a day"
          >
            daily
          </span>
        )}
      </p>

      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-lg font-semibold tabular-nums tracking-tight text-text">
          {quote.price.toLocaleString('en-US', {
            minimumFractionDigits: quote.decimals,
            maximumFractionDigits: quote.decimals,
          })}
        </span>
        <span className={`text-[10px] tabular-nums ${tone}`}>
          {sign}
          {Math.abs(quote.change).toLocaleString('en-US', {
            minimumFractionDigits: quote.decimals,
            maximumFractionDigits: quote.decimals,
          })}
        </span>
      </div>
    </article>
  );
}
