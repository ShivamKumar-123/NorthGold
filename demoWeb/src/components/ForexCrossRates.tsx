import Reveal from '@/components/Reveal';
import WaveDivider from '@/components/WaveDivider';
import SplitWords from '@/components/SplitWords';
import TradingViewWidget from '@/components/TradingViewWidget';

/**
 * The cross-rate grid: every listed currency against every other, live.
 *
 * Same `on-dark` reasoning as the band above it — the embed's colour theme is
 * fixed at mount, so the panel holding it cannot follow the site theme.
 */
export default function ForexCrossRates() {
  return (
    <section id="cross-rates" className="relative isolate overflow-hidden border-b border-border bg-bg">
      <WaveDivider position="top" />
      <WaveDivider position="bottom" />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-3xl text-center" data-anim="head">
          <p className="eyebrow" data-head="eyebrow">
            Cross rates
          </p>
          <h2 className="mt-3 text-display-sm font-semibold tracking-tight text-3d" data-head="title">
            <SplitWords text="Forex Chart" />
          </h2>
          <span
            className="mx-auto mt-4 block h-px w-24 bg-gradient-to-r from-accent to-transparent"
            data-head="rule"
            aria-hidden
          />
          <p className="mt-4 leading-relaxed text-text-muted" data-head="copy">
            Every currency against every other, coloured by how far it has
            moved this session — green up, red down. Read a row to see how one
            currency is holding up against the rest.
          </p>
        </div>

        <Reveal delay={120}>
          {/* Wide by nature: on a phone the grid scrolls inside its own box
              rather than forcing the page to scroll sideways. */}
          <div className="mt-12 overflow-hidden rounded-2xl bg-white shadow-e4 ring-1 ring-black/10">
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <TradingViewWidget
                  widget="forex-heat-map"
                  height={480}
                  // The heat map, not the cross-rates grid. Cross rates print
                  // the raw exchange rate in every cell — a wall of numbers
                  // with nothing to read at a glance. The heat map prints the
                  // MOVE, and colours it, which is what makes a grid this size
                  // worth looking at.
                  //
                  // `autosize` on its own, and light so it matches the quote
                  // cards above rather than changing register halfway down.
                  config={{
                    currencies: ['EUR', 'USD', 'JPY', 'GBP', 'CHF', 'AUD', 'CAD', 'INR', 'AED', 'SGD'],
                    isTransparent: false,
                    colorTheme: 'light',
                    locale: 'en',
                    autosize: true,
                  }}
                />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
