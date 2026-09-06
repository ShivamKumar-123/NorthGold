import { useEffect, useRef, useState } from 'react';

/**
 * Counts up to `value` the first time it scrolls into view.
 *
 * The final value is rendered immediately on the server and whenever motion is
 * reduced, so the real number is always the fallback — the animation only ever
 * replaces a number that would otherwise already be correct.
 */
export default function Counter({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 1400,
  className = '',
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !Number.isFinite(value)) return;

    // NB: the display is deliberately NOT zeroed here. If the observer never
    // fires — the element sits only partly in view, or the page is captured
    // before it scrolls — the real number must still be on screen. Zero is a
    // wrong value, not a neutral one.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        observer.disconnect();

        setDisplay(0);
        const start = performance.now();
        let frame = 0;

        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          // easeOutExpo — fast out of the gate, long settle. Reads as "counting
          // up and landing" rather than a linear crawl.
          const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          setDisplay(value * eased);
          if (t < 1) frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
      },
      // A low threshold so a stat sitting at the fold still counts up rather
      // than waiting for 40% of it to scroll into view.
      { threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {display.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
