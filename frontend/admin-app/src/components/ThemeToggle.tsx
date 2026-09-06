'use client';

import { Moon, Sun } from 'lucide-react';

import { useTheme } from '@/lib/theme';

/**
 * Light/dark switch.
 *
 * Rendered as a single button rather than a segmented control: with only two
 * states the icon of the *other* theme is the clearest affordance, and it costs
 * one tap instead of two on mobile.
 *
 * The icons are absolutely centred in a fixed 40x40 box, so swapping one for
 * the other cannot shift the layout around it.
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      // The label states the DESTINATION, not the current state — that is what
      // a screen-reader user is choosing when they activate it.
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      className={`group relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl
                  border border-border bg-bg-card/60 text-text-muted backdrop-blur
                  transition-all duration-200 hover:border-accent/45 hover:text-accent
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${className}`}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(circle at 50% 50%, rgba(217,166,46,.22), transparent 70%)' }}
        aria-hidden
      />
      {/* One glyph, swapped outright. A cross-fade of two stacked icons spends
          300ms showing a sun and a moon on top of each other, which at 17px is
          just a smudge — the swap reads more cleanly than the transition did. */}
      <span className="relative transition-transform duration-300 group-active:rotate-45">
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </span>
    </button>
  );
}
