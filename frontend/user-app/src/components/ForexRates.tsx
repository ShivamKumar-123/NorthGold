'use client';

import Reveal from '@/components/Reveal';
import WaveDivider from '@/components/WaveDivider';
import SplitWords from '@/components/SplitWords';
import TradingViewWidget from '@/components/TradingViewWidget';

const PAIRS = [
  { symbol: 'FX:EURUSD', label: 'EUR / U.S. Dollar' },
  { symbol: 'FX:GBPUSD', label: 'British Pound / U.S. Dollar' },
  { symbol: 'FX:USDCAD', label: 'U.S. Dollar / Canadian Dollar' },
];

/**
 * The live foreign-exchange band.
 *
 * Marked `on-dark` and painted over the photograph: the quotes inside are
 * TradingView embeds whose colour theme is fixed when they mount, so the
 * panel around them has to be dark in both site themes or the widgets stop
 * matching their own surroundings the moment someone flips the toggle.
 */
export default function ForexRates() {
  return (
    <section
      id="fx"
      className="on-dark relative isolate overflow-hidden border-b border-border bg-[#0b0b0c]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/bg/forex.webp"
        alt=""
        width={2048}
        height={768}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 -z-20 h-full w-full object-cover"
        aria-hidden
      />
      {/* The photograph is busy on its right-hand side, where the cards sit.
          A scrim keeps the quotes readable without flattening the artwork. */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            'linear-gradient(180deg, rgba(8,8,9,.78) 0%, rgba(8,8,9,.62) 45%, rgba(8,8,9,.88) 100%)',
        }}
        aria-hidden
      />

      <WaveDivider position="top" />
      <WaveDivider position="bottom" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-3xl text-center" data-anim="head">
          <p className="eyebrow" data-head="eyebrow">
            Live markets
          </p>
          <h2 className="mt-3 text-display-sm font-semibold tracking-tight text-text text-3d" data-head="title">
            <SplitWords text="Foreign Exchange Rates" />
          </h2>
          <span
            className="mx-auto mt-4 block h-px w-24 bg-gradient-to-r from-accent to-transparent"
            data-head="rule"
            aria-hidden
          />
          <p className="mt-4 leading-relaxed text-text-muted" data-head="copy">
            The major pairs, streaming live through the trading session — the
            same quotes the desks watch, not a daily snapshot.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {PAIRS.map((pair, i) => (
            <Reveal key={pair.symbol} delay={i * 110}>
              <div className="overflow-hidden rounded-2xl bg-white shadow-e4 ring-1 ring-black/10">
                <TradingViewWidget
                  widget="mini-symbol-overview"
                  height={230}
                  // `autosize` and an explicit width/height are mutually
                  // exclusive: pass both and the widget throws the whole
                  // config away.
                  //
                  // Light, not dark. The embed's own dark variant would not
                  // take reliably, and light is what the design called for
                  // anyway: a white quote card on the photograph reads as a
                  // terminal pinned to the wall.
                  config={{
                    symbol: pair.symbol,
                    locale: 'en',
                    dateRange: '12M',
                    colorTheme: 'light',
                    isTransparent: false,
                    autosize: true,
                  }}
                />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
