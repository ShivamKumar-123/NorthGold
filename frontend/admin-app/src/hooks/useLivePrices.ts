'use client';

import { useEffect, useRef, useState } from 'react';

import { WS_BASE, api } from '@/lib/api';
import type { PriceTick } from '@/types';

type State = {
  prices: Record<string, PriceTick>;
  connected: boolean;
  /** Set for one render after a symbol moves, so a row can flash green/red. */
  flash: Record<string, 'up' | 'down'>;
};

/**
 * Live instrument prices.
 *
 * Seeds from the REST snapshot so the first paint is never empty, then keeps
 * itself current over the WebSocket. If the socket cannot be opened — a proxy
 * without upgrade support, a corporate firewall — it falls back to polling the
 * same snapshot endpoint, so the page degrades rather than freezing.
 */
export function useLivePrices(symbols?: string[]) {
  const [state, setState] = useState<State>({ prices: {}, connected: false, flash: {} });
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const closedByUs = useRef(false);
  const symbolKey = symbols?.join(',') ?? '';

  useEffect(() => {
    closedByUs.current = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const applyTicks = (ticks: PriceTick[]) => {
      if (!ticks.length) return;
      setState((prev) => {
        const prices = { ...prev.prices };
        const flash: Record<string, 'up' | 'down'> = {};
        for (const tick of ticks) {
          const before = prices[tick.symbol];
          if (before && before.price !== tick.price) {
            flash[tick.symbol] = tick.price > before.price ? 'up' : 'down';
          }
          prices[tick.symbol] = tick;
        }
        return { ...prev, prices, flash };
      });
    };

    const snapshot = async () => {
      try {
        const query = symbolKey ? `?symbols=${encodeURIComponent(symbolKey)}` : '';
        const res = await api.get<{ ticks: PriceTick[] }>(`/instruments/prices/${query}`, {
          auth: false,
        });
        applyTicks(res.ticks);
      } catch {
        /* the socket may still deliver; leave whatever we have on screen */
      }
    };

    const startPolling = () => {
      if (pollTimer) return;
      pollTimer = setInterval(snapshot, 10_000);
    };

    const connect = () => {
      if (typeof window === 'undefined' || closedByUs.current) return;
      let socket: WebSocket;
      try {
        socket = new WebSocket(`${WS_BASE}/prices/`);
      } catch {
        startPolling();
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        retryRef.current = 0;
        setState((prev) => ({ ...prev, connected: true }));
        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
        if (symbols?.length) {
          socket.send(JSON.stringify({ action: 'subscribe', symbols }));
        }
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'prices' && Array.isArray(data.ticks)) applyTicks(data.ticks);
        } catch {
          /* ignore malformed frames */
        }
      };

      socket.onclose = () => {
        setState((prev) => ({ ...prev, connected: false }));
        if (closedByUs.current) return;
        // Exponential backoff, capped — then poll so the page still updates.
        retryRef.current += 1;
        if (retryRef.current > 4) {
          startPolling();
          return;
        }
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** retryRef.current, 15_000));
      };

      socket.onerror = () => socket.close();
    };

    void snapshot();
    connect();

    return () => {
      closedByUs.current = true;
      if (pollTimer) clearInterval(pollTimer);
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolKey]);

  // Clear flash markers shortly after they are applied so the animation can
  // retrigger on the next move.
  useEffect(() => {
    if (!Object.keys(state.flash).length) return;
    const timer = setTimeout(() => setState((prev) => ({ ...prev, flash: {} })), 750);
    return () => clearTimeout(timer);
  }, [state.flash]);

  return state;
}
