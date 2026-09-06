'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * A TradingView embed.
 *
 * These widgets are the only free source of genuinely live forex, metals and
 * index quotes — everything else is either a quarter-hour delayed or behind a
 * paid key. The cost is a third-party script and TradingView's attribution
 * link, which their terms require and which is therefore not optional.
 *
 * The embed works by appending a <script> whose body is its own JSON config;
 * the script then writes an iframe into the container beside it. That is not
 * something React can express as markup, so it is done imperatively here and
 * torn down completely on unmount — leaving the old iframe in place would
 * stack a second one on every remount.
 */
export default function TradingViewWidget({
  widget,
  config,
  className = '',
  height,
}: {
  /** The embed name, e.g. `mini-symbol-overview`. */
  widget: string;
  config: Record<string, unknown>;
  className?: string;
  height: number | string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  // Config is an object literal at every call site, so a reference check would
  // reload the widget on every render. Serialising it compares by value.
  const key = JSON.stringify(config);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    setFailed(false);
    host.innerHTML = '';

    const mount = document.createElement('div');
    mount.className = 'tradingview-widget-container__widget';
    mount.style.height = '100%';
    host.appendChild(mount);

    const script = document.createElement('script');
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${widget}.js`;
    script.async = true;
    script.innerHTML = key;
    host.appendChild(script);

    // If the script is blocked — offline, an ad blocker, a firewalled network —
    // nothing ever appears and an empty box is left behind with no explanation.
    // Say so instead.
    const check = window.setTimeout(() => {
      if (!host.querySelector('iframe')) setFailed(true);
    }, 9000);

    return () => {
      window.clearTimeout(check);
      host.innerHTML = '';
    };
  }, [widget, key]);

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <div ref={ref} className="tradingview-widget-container h-full w-full" />
      {failed && (
        <p className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-text-dim">
          Live rates are unavailable right now.
        </p>
      )}
    </div>
  );
}
