import { useEffect, useRef, useState } from 'react';

/**
 * Live market prices for the hero ticker.
 *
 * Two sources, because only one of them is honestly live:
 *
 *  - Crypto streams from Binance over a WebSocket. No key, no account, and it
 *    pushes a fresh 24h ticker roughly once a second per symbol.
 *  - Currencies come from Frankfurter, which publishes the European Central
 *    Bank's reference rates ONCE A DAY. They are quoted here with `daily` set
 *    so the card can say so; showing a once-a-day rate on a strip that never
 *    stops moving, without saying which it is, would be a lie of presentation.
 *
 * Gold, silver and the indices are deliberately absent. Every free source for
 * them is either delayed by a quarter of an hour or needs a paid key, and a
 * stale metal price dressed as live is worse than no metal price.
 */

export type MarketQuote = {
  id: string;
  /** How the pair is written on the card, e.g. "BTC/USD". */
  label: string;
  name: string;
  price: number;
  /** Absolute move over the quote's own window (24h for crypto, 1 session for FX). */
  change: number;
  percent: number;
  decimals: number;
  /** True when the number is a daily reference rate rather than a live tick. */
  daily: boolean;
  accent: string;
};

const CRYPTO = [
  { symbol: 'BTCUSDT', label: 'BTC/USD', name: 'Bitcoin', accent: '#f7931a' },
  { symbol: 'ETHUSDT', label: 'ETH/USD', name: 'Ethereum', accent: '#627eea' },
  { symbol: 'BNBUSDT', label: 'BNB/USD', name: 'BNB', accent: '#f0b90b' },
  { symbol: 'SOLUSDT', label: 'SOL/USD', name: 'Solana', accent: '#14f195' },
  { symbol: 'XRPUSDT', label: 'XRP/USD', name: 'XRP', accent: '#7d8b99' },
  { symbol: 'ADAUSDT', label: 'ADA/USD', name: 'Cardano', accent: '#3468d1' },
  { symbol: 'DOGEUSDT', label: 'DOGE/USD', name: 'Dogecoin', accent: '#c2a633' },
  { symbol: 'TRXUSDT', label: 'TRX/USD', name: 'TRON', accent: '#eb0029' },
  { symbol: 'LTCUSDT', label: 'LTC/USD', name: 'Litecoin', accent: '#a6a9aa' },
  { symbol: 'LINKUSDT', label: 'LINK/USD', name: 'Chainlink', accent: '#2a5ada' },
  { symbol: 'AVAXUSDT', label: 'AVAX/USD', name: 'Avalanche', accent: '#e84142' },
  { symbol: 'DOTUSDT', label: 'DOT/USD', name: 'Polkadot', accent: '#e6007a' },
];

const FOREX = [
  { code: 'AUD', label: 'AUD/USD', name: 'Australian Dollar', invert: true, accent: '#00843d' },
  { code: 'EUR', label: 'EUR/USD', name: 'Euro', invert: true, accent: '#3a5fb8' },
  { code: 'GBP', label: 'GBP/USD', name: 'British Pound', invert: true, accent: '#c8102e' },
  { code: 'JPY', label: 'USD/JPY', name: 'Japanese Yen', invert: false, accent: '#bc002d' },
];

const BINANCE_REST = 'https://api.binance.com/api/v3/ticker/24hr';
const BINANCE_WS = 'wss://stream.binance.com:9443/stream';
const FRANKFURTER = 'https://api.frankfurter.dev/v1';

/** Decimals that suit the magnitude — 79,828.32 and 0.20134 both read right. */
function decimalsFor(price: number) {
  const p = Math.abs(price);
  if (p >= 100) return 2;
  if (p >= 1) return 4;
  if (p >= 0.01) return 5;
  return 6;
}

type Row = { price: number; change: number; percent: number };

export function useMarketPrices() {
  const [crypto, setCrypto] = useState<Record<string, Row>>({});
  const [forex, setForex] = useState<MarketQuote[]>([]);
  const [connected, setConnected] = useState(false);

  // Ticks arrive about once a second per symbol. Buffering them and flushing
  // on a timer keeps a dozen streams from driving a dozen renders a second.
  const buffer = useRef<Record<string, Row>>({});
  const dirty = useRef(false);

  useEffect(() => {
    let alive = true;
    let socket: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;

    const apply = (rows: Record<string, Row>) => {
      Object.assign(buffer.current, rows);
      dirty.current = true;
    };

    const flush = setInterval(() => {
      if (!dirty.current || !alive) return;
      dirty.current = false;
      setCrypto({ ...buffer.current });
    }, 900);

    /** REST snapshot: fills the strip before the socket says anything, and
     *  keeps it moving if the socket never opens. */
    const snapshot = async () => {
      try {
        const list = JSON.stringify(CRYPTO.map((c) => c.symbol));
        const res = await fetch(`${BINANCE_REST}?symbols=${encodeURIComponent(list)}`);
        if (!res.ok) throw new Error(String(res.status));
        const data: Array<{ symbol: string; lastPrice: string; priceChange: string; priceChangePercent: string }> =
          await res.json();
        if (!alive) return;
        const rows: Record<string, Row> = {};
        data.forEach((d) => {
          rows[d.symbol] = {
            price: Number(d.lastPrice),
            change: Number(d.priceChange),
            percent: Number(d.priceChangePercent),
          };
        });
        apply(rows);
      } catch {
        // Offline, blocked, or rate-limited. The strip simply stays with
        // whatever it already has; it must never take the page down.
      }
    };

    const startPolling = () => {
      if (poll) return;
      poll = setInterval(snapshot, 15000);
    };
    const stopPolling = () => {
      if (poll) clearInterval(poll);
      poll = null;
    };

    const open = () => {
      const streams = CRYPTO.map((c) => `${c.symbol.toLowerCase()}@ticker`).join('/');
      try {
        socket = new WebSocket(`${BINANCE_WS}?streams=${streams}`);
      } catch {
        startPolling();
        return;
      }

      socket.onopen = () => {
        if (!alive) return;
        attempts = 0;
        setConnected(true);
        stopPolling();
      };

      socket.onmessage = (event) => {
        if (!alive) return;
        try {
          const frame = JSON.parse(event.data as string);
          const d = frame?.data;
          if (!d?.s) return;
          apply({ [d.s]: { price: Number(d.c), change: Number(d.p), percent: Number(d.P) } });
        } catch {
          // A malformed frame is not worth tearing the socket down for.
        }
      };

      const drop = () => {
        if (!alive) return;
        setConnected(false);
        startPolling();
        // Backed off, so a blocked region does not reconnect in a tight loop.
        attempts += 1;
        const wait = Math.min(30000, 2000 * 2 ** Math.min(attempts, 4));
        reconnect = setTimeout(open, wait);
      };

      socket.onerror = () => socket?.close();
      socket.onclose = drop;
    };

    /** ECB reference rates. Two most recent publication days give the move;
     *  a ten-day window is enough to clear a long weekend. */
    const loadForex = async () => {
      try {
        const from = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
        const codes = FOREX.map((f) => f.code).join(',');
        const res = await fetch(`${FRANKFURTER}/${from}..?base=USD&symbols=${codes}`);
        if (!res.ok) throw new Error(String(res.status));
        const data: { rates: Record<string, Record<string, number>> } = await res.json();
        if (!alive) return;

        const days = Object.keys(data.rates ?? {}).sort();
        if (days.length < 2) return;
        const today = data.rates[days[days.length - 1]];
        const before = data.rates[days[days.length - 2]];

        const quotes = FOREX.flatMap<MarketQuote>((f) => {
          const now = today?.[f.code];
          const prev = before?.[f.code];
          if (!now || !prev) return [];
          // Frankfurter quotes USD -> X. AUD/USD and friends are written the
          // other way round, so those get inverted before anything is derived
          // from them — inverting the change afterwards would be wrong.
          const price = f.invert ? 1 / now : now;
          const past = f.invert ? 1 / prev : prev;
          return [{
            id: f.label,
            label: f.label,
            name: f.name,
            price,
            change: price - past,
            percent: ((price - past) / past) * 100,
            decimals: decimalsFor(price),
            daily: true,
            accent: f.accent,
          }];
        });
        setForex(quotes);
      } catch {
        // Currencies drop off the strip; the crypto half carries on.
      }
    };

    snapshot();
    open();
    loadForex();

    return () => {
      alive = false;
      clearInterval(flush);
      stopPolling();
      if (reconnect) clearTimeout(reconnect);
      if (socket) {
        // Detach first: `close()` fires `onclose`, which would otherwise
        // schedule a reconnect for a component that is going away.
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        socket.close();
      }
    };
  }, []);

  const quotes: MarketQuote[] = [
    ...CRYPTO.flatMap<MarketQuote>((c) => {
      const row = crypto[c.symbol];
      if (!row || !Number.isFinite(row.price)) return [];
      return [{
        id: c.symbol,
        label: c.label,
        name: c.name,
        price: row.price,
        change: row.change,
        percent: row.percent,
        decimals: decimalsFor(row.price),
        daily: false,
        accent: c.accent,
      }];
    }),
    ...forex,
  ];

  return { quotes, connected };
}
