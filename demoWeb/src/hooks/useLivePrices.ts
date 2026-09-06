import { useEffect, useRef, useState } from 'react';

import { getInstruments, subscribe, tickPrices } from '@/lib/store';
import type { Instrument } from '@/lib/types';

export type PriceTick = { symbol: string; price: number; change_percent: number };

type State = {
  prices: Record<string, PriceTick>;
  connected: boolean;
  /** Set for one render after a symbol moves, so a row can flash green/red. */
  flash: Record<string, 'up' | 'down'>;
};

/**
 * Live instrument prices.
 *
 * The production build streams these over a WebSocket. Here the "feed" is a
 * timer that walks the feed-priced instruments a fraction of a percent every
 * few seconds — enough for the board to be visibly alive, and bounded so a
 * tab left open overnight does not end up quoting nonsense.
 *
 * `connected` stays true because there is no socket to drop; the badge it
 * drives still has a meaning, it just never reads "delayed" in the demo.
 */
export function useLivePrices(symbols?: string[]) {
  const [state, setState] = useState<State>(() => ({
    prices: snapshot(getInstruments(), symbols),
    connected: true,
    flash: {},
  }));
  const previous = useRef(state.prices);

  useEffect(() => {
    const sync = () => {
      const next = snapshot(getInstruments(), symbols);
      const flash: Record<string, 'up' | 'down'> = {};
      Object.entries(next).forEach(([symbol, tick]) => {
        const before = previous.current[symbol];
        if (before && before.price !== tick.price) {
          flash[symbol] = tick.price > before.price ? 'up' : 'down';
        }
      });
      previous.current = next;
      setState({ prices: next, connected: true, flash });
    };

    const timer = setInterval(() => {
      tickPrices();
    }, 4000);
    const stop = subscribe(sync);
    sync();

    return () => {
      clearInterval(timer);
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols?.join(',')]);

  // The flash is a one-shot: clear it so the row does not stay tinted.
  useEffect(() => {
    if (!Object.keys(state.flash).length) return;
    const timer = setTimeout(() => setState((s) => ({ ...s, flash: {} })), 800);
    return () => clearTimeout(timer);
  }, [state.flash]);

  return state;
}

function snapshot(instruments: Instrument[], symbols?: string[]): Record<string, PriceTick> {
  const wanted = symbols?.length ? new Set(symbols) : null;
  const out: Record<string, PriceTick> = {};
  instruments.forEach((i) => {
    if (wanted && !wanted.has(i.symbol)) return;
    out[i.symbol] = { symbol: i.symbol, price: i.current_price, change_percent: i.change_percent };
  });
  return out;
}
