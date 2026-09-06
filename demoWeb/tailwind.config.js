/** @type {import('tailwindcss').Config} */

/* ── NorthGold palette ──────────────────────────────────────────────────────
   Premium Gold  #D9A62E   main gold
   Bright Gold   #F5C34A   highlights / gradients
   Deep Gold     #A87516   shadows / 3D depth
   Silver White  #E8E8E5   body text
   Charcoal      #1A1A1A   raised surfaces
   Deep Black    #080808   background
   ------------------------------------------------------------------------ */

export default {
  // Class-based: the theme is a deliberate user choice persisted to storage,
  // not just a media query, and the blocking script sets it before paint.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces climb from Deep Black toward Charcoal as they gain
        // elevation — that ramp is what sells depth on a black UI.
        bg: {
          DEFAULT: 'rgb(var(--c-bg) / <alpha-value>)',
          sunken: 'rgb(var(--c-bg-sunken) / <alpha-value>)',
          card: 'rgb(var(--c-bg-card) / <alpha-value>)',
          elevated: 'rgb(var(--c-bg-elevated) / <alpha-value>)',
          float: 'rgb(var(--c-bg-float) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--c-border) / <alpha-value>)',
          strong: 'rgb(var(--c-border-strong) / <alpha-value>)',
          subtle: 'rgb(var(--c-border-subtle) / <alpha-value>)',
        },
        // Gold is the accent. `accent` and `gold` are deliberate aliases so
        // both reads ("the brand colour" / "the gold") resolve identically.
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          flat: '#D9A62E',
          hover: '#E8B63C',
          bright: '#F5C34A',
          deep: '#A87516',
          soft: '#4A390F',
          glow: 'rgba(217, 166, 46, 0.45)',
        },
        gold: {
          DEFAULT: '#D9A62E',
          bright: '#F5C34A',
          deep: '#A87516',
        },
        // Secondary data-viz hues, kept inside the warm range so the network
        // levels stay distinguishable without leaving the palette.
        bronze: '#B87333',
        silver: '#E8E8E5',
        charcoal: '#1A1A1A',

        // Up/down stay green/red — that convention is not ours to restyle.
        success: { DEFAULT: '#22c55e', soft: 'rgba(34, 197, 94, 0.14)' },
        danger: { DEFAULT: '#f43f5e', soft: 'rgba(244, 63, 94, 0.14)' },
        // Orange, not amber: amber sits on top of the gold accent and a
        // "pending" badge would read as a brand element.
        warn: { DEFAULT: '#f97316', soft: 'rgba(249, 115, 22, 0.15)' },

        text: {
          DEFAULT: 'rgb(var(--c-text) / <alpha-value>)',
          muted: 'rgb(var(--c-text-muted) / <alpha-value>)',
          dim: 'rgb(var(--c-text-dim) / <alpha-value>)',
          faint: 'rgb(var(--c-text-faint) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Minimums fit a 320px viewport; a larger floor overflows and
        // `overflow-x: hidden` then silently clips the headline.
        'display-sm': ['clamp(1.6rem, 5vw, 2.75rem)', { lineHeight: '1.12', letterSpacing: '-0.022em' }],
        display: ['clamp(1.9rem, 6.4vw, 4.5rem)', { lineHeight: '1.04', letterSpacing: '-0.032em' }],
        'display-lg': ['clamp(2.2rem, 8vw, 6rem)', { lineHeight: '1', letterSpacing: '-0.038em' }],
      },
      // Depth ladder: each step adds a wider, softer shadow plus a brighter
      // top bevel, so a raised element reads as physically closer.
      boxShadow: {
        e1: '0 1px 2px rgba(0,0,0,.7), 0 4px 12px -4px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.05)',
        e2: '0 2px 4px rgba(0,0,0,.6), 0 12px 28px -10px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.07)',
        e3: '0 4px 8px rgba(0,0,0,.6), 0 28px 60px -20px rgba(0,0,0,.9), inset 0 1px 0 rgba(255,255,255,.09)',
        e4: '0 8px 16px rgba(0,0,0,.65), 0 48px 100px -30px rgba(0,0,0,1), inset 0 1px 0 rgba(255,255,255,.11)',
        glow: '0 0 60px -12px rgba(217,166,46,.6)',
        'glow-gold': '0 0 60px -12px rgba(245,195,74,.55)',
        'glow-bronze': '0 0 60px -12px rgba(184,115,51,.5)',
        // Extruded control: Deep Gold is the solid block beneath the face.
        'btn-3d': '0 4px 0 0 #A87516, 0 8px 20px -6px rgba(217,166,46,.55), inset 0 1px 0 rgba(255,255,255,.35)',
        'btn-3d-press': '0 1px 0 0 #A87516, 0 3px 10px -4px rgba(217,166,46,.45), inset 0 1px 0 rgba(255,255,255,.25)',
        'btn-3d-ghost': '0 3px 0 0 rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.07)',
      },
      keyframes: {
        'flash-up': {
          '0%': { backgroundColor: 'rgba(34,197,94,.2)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'flash-down': {
          '0%': { backgroundColor: 'rgba(244,63,94,.2)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        // Opposing drift paths so the hero never repeats a frame exactly.
        'drift-a': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '33%': { transform: 'translate3d(6%,-8%,0) scale(1.12)' },
          '66%': { transform: 'translate3d(-5%,5%,0) scale(.94)' },
        },
        'drift-b': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1.05)' },
          '33%': { transform: 'translate3d(-8%,6%,0) scale(.92)' },
          '66%': { transform: 'translate3d(7%,-4%,0) scale(1.15)' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
        'float-slow': {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-22px)' },
        },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(.85)', opacity: '.7' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'dash-flow': { to: { strokeDashoffset: '-16' } },
      },
      animation: {
        'flash-up': 'flash-up 800ms ease-out',
        'flash-down': 'flash-down 800ms ease-out',
        'fade-up': 'fade-up 500ms cubic-bezier(.22,1,.36,1) both',
        'drift-a': 'drift-a 24s ease-in-out infinite',
        'drift-b': 'drift-b 30s ease-in-out infinite',
        float: 'float 7s ease-in-out infinite',
        'float-slow': 'float-slow 11s ease-in-out infinite',
        'spin-slow': 'spin-slow 26s linear infinite',
        marquee: 'marquee 48s linear infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(.24,0,.38,1) infinite',
        shimmer: 'shimmer 2.6s linear infinite',
        'dash-flow': 'dash-flow 1s linear infinite',
      },
    },
  },
  plugins: [
    // 3D transform utilities. Tailwind v3 ships none of these natively.
    function ({ addUtilities }) {
      const perspectives = { sm: '600px', DEFAULT: '1000px', lg: '1600px', xl: '2400px' };
      const utilities = {
        '.preserve-3d': { transformStyle: 'preserve-3d' },
        '.flatten-3d': { transformStyle: 'flat' },
        '.backface-hidden': { backfaceVisibility: 'hidden' },
        '.perspective-origin-top': { perspectiveOrigin: 'center top' },
      };
      for (const [key, value] of Object.entries(perspectives)) {
        const name = key === 'DEFAULT' ? '.perspective' : `.perspective-${key}`;
        utilities[name] = { perspective: value };
      }
      for (const z of [0, 1, 2, 4, 8, 12, 16, 24, 32, 48, 64, 80]) {
        utilities[`.translate-z-${z}`] = { transform: `translateZ(${z}px)` };
        utilities[`.-translate-z-${z}`] = { transform: `translateZ(-${z}px)` };
      }
      addUtilities(utilities);
    },
  ],
};
