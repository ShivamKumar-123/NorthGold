import Reveal from '@/components/Reveal';
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
    <section id="cross-rates" className="relative isolate border-b border-border bg-bg">
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
            Every currency against every other, moving as the session moves.
            Read a row to see how one currency is doing against the rest.
          </p>
        </div>

        <Reveal delay={120}>
          {/* Wide by nature: on a phone the grid scrolls inside its own box
              rather than forcing the page to scroll sideways. */}
          <div className="mt-12 overflow-hidden rounded-2xl bg-white shadow-e4 ring-1 ring-black/10">
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <TradingViewWidget
                  widget="forex-cross-rates"
                  height={480}
                  // Same rule as the mini charts — `autosize` on its own,
                  // and light so the grid matches the quote cards above it
                  // rather than changing register halfway down the page.
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
