'use client';

import { Radio, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';

import { useLivePrices } from '@/hooks/useLivePrices';
import { money, num } from '@/lib/api';
import type { Instrument } from '@/types';
import Tilt from './Tilt';

/**
 * The instrument grid.
 *
 * `instruments` supplies the catalogue (name, issuer, rate, minimum); prices
 * arrive separately over the live feed and are merged by symbol, so a dropped
 * socket degrades to the server-rendered snapshot rather than an empty grid.
 */
export default function PriceTicker({ instruments }: { instruments: Instrument[] }) {
  const symbols = useMemo(() => instruments.map((i) => i.symbol), [instruments]);
  const { prices, connected, flash } = useLivePrices(symbols);

  if (!instruments.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
        <p className="font-medium text-text">No instruments listed yet</p>
        <p className="mt-1.5 text-sm text-text-muted">
          An administrator can publish them from the admin panel.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="chip">
          <span className="relative flex h-2 w-2">
            {connected && (
              <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-success" />
            )}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                connected ? 'bg-success' : 'bg-text-faint'
              }`}
            />
          </span>
          {connected ? 'Streaming live' : 'Reconnecting — showing last known prices'}
        </span>
        <span className="text-xs text-text-dim">{instruments.length} listed</span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {instruments.map((instrument) => (
          <InstrumentCard
            key={instrument.id}
            instrument={instrument}
            tick={prices[instrument.symbol]}
            flash={flash[instrument.symbol]}
          />
        ))}
      </div>
    </div>
  );
}

function InstrumentCard({
  instrument,
  tick,
  flash,
}: {
  instrument: Instrument;
  tick?: { price: number; change_percent: number };
  flash?: 'up' | 'down';
}) {
  const price = tick?.price ?? Number(instrument.current_price);
  const change = tick?.change_percent ?? Number(instrument.change_percent);
  const up = change >= 0;

  return (
    <Tilt max={7} lift={16} className="h-full">
      <div
        className={`card preserve-3d group h-full overflow-hidden p-5 transition-shadow duration-300
                    hover:border-accent/40 hover:shadow-e4
                    ${flash === 'up' ? 'animate-flash-up' : flash === 'down' ? 'animate-flash-down' : ''}`}
      >
        {/* Accent bloom on hover */}
        <span
          className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-accent/25 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
          aria-hidden
        />

        <div className="relative flex items-start justify-between gap-3 layer-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-0.5 font-mono text-[11px] font-semibold text-accent shadow-e1">
                {instrument.symbol}
              </span>
              {instrument.price_source === 'feed' && (
                <Radio size={11} className="text-success" aria-label="Live feed" />
              )}
            </div>
            <p className="mt-3 truncate font-medium text-text">{instrument.name}</p>
            <p className="mt-0.5 truncate text-xs text-text-muted">
              {instrument.issuer_name || 'Unlisted issuer'} · {instrument.category_label}
            </p>
          </div>

        </div>

        <div className="relative mt-6 flex items-end justify-between gap-4 layer-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-text-dim">Price</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-3d">
              {num(price, 2)}
            </p>
            <p
              className={`mt-1 flex items-center gap-1 text-xs font-medium tabular-nums ${
                up ? 'text-success' : 'text-danger'
              }`}
            >
              {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {up ? '+' : ''}
              {change.toFixed(2)}%
            </p>
          </div>

          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.14em] text-text-dim">Rate p.a.</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-gradient-gold">
              {num(instrument.interest_rate, 2)}%
            </p>
          </div>
        </div>

        <div className="relative mt-5 flex items-center justify-between border-t border-white/[0.06] pt-3.5 text-xs text-text-muted layer-1">
          <span>
            Min{' '}
            <span className="text-text">
              {money(instrument.min_investment, instrument.currency).replace('.00', '')}
            </span>
          </span>
          <span>{instrument.tenure_months} month term</span>
        </div>
      </div>
    </Tilt>
  );
}
