'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

import Logo from '@/components/Logo';

/**
 * The welcome curtain.
 *
 * Plays once per browser session: two gold rings draw themselves around the
 * mark, the wordmark resolves out of a blur, the greeting types in letter by
 * letter over a sweeping highlight, a progress arc completes, and the panel
 * splits along a bright gold seam to reveal the page.
 *
 * Four rules it holds to:
 *
 * 1. It renders NOTHING unless it is actually going to play, and it decides in
 *    a LAYOUT effect — React flushes those before the browser paints, so the
 *    curtain is up for the very first frame. An earlier version waited on the
 *    auth context to resolve, which happens in a passive effect *after* paint:
 *    the page appeared first and the intro then covered it, which reads as a
 *    glitch rather than a welcome.
 * 2. It is skippable — click, tap or any key fast-forwards to the reveal.
 * 3. Reduced motion skips it entirely. It is decoration; the page beneath is
 *    already complete.
 * 4. A failsafe lifts it even if the ticker never runs. An intro that can trap
 *    someone behind a black screen is worse than no intro.
 */

// Versioned: a stale key from an earlier build would keep the intro
// suppressed forever in a tab that had already loaded the site once — which is
// exactly what happened while this was being built.
import { signalWelcomeDone } from '@/lib/welcomeSignal';

const SESSION_KEY = 'ng_welcome_seen_v2';

/** Total run time, start to reveal. Set on the timeline rather than tuned
 *  across a dozen durations, so changing it stays a one-line edit. */
const RUN_SECONDS = 4;

export default function WelcomeOverlay({ name }: { name?: string }) {
  // Starts false on both the server and the first client render, then flips in
  // the layout effect below. Deciding in the `useState` initialiser instead
  // would make the client's first render disagree with the server's — a
  // hydration mismatch — because `sessionStorage` does not exist during SSR.
  const [active, setActive] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    // Every path out of here announces itself, including the ones that
    // never play — whatever follows the curtain must not wait forever
    // for an animation that was skipped.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      signalWelcomeDone();
      return;
    }

    // `?welcome=1` forces a replay. Showing this to someone is otherwise a
    // matter of clearing session storage by hand, and an intro you cannot
    // re-watch is an intro nobody checks.
    const forced = new URLSearchParams(window.location.search).get('welcome') === '1';

    if (!forced) {
      try {
        if (sessionStorage.getItem(SESSION_KEY)) {
          signalWelcomeDone();
          return;
        }
      } catch {
        // Storage blocked: play it rather than never. One extra intro beats a
        // broken first impression.
      }
    }
    setActive(true);
  }, []);

  useLayoutEffect(() => {
    if (!active || !rootRef.current) return;

    // The page behind must not scroll while the curtain is over it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: () => {
          // Recorded on COMPLETION, not on mount. Writing it up front meant a
          // run that was interrupted — or one that never played because of a
          // bug — still burned the single showing for that session.
          try {
            sessionStorage.setItem(SESSION_KEY, '1');
          } catch {
            /* nothing to remember it with */
          }
          setActive(false);
          signalWelcomeDone();
        },
      });
      timeline.current = tl;

      // `fromTo` throughout, never `from`: a `from` tween samples its end value
      // out of the DOM, and under StrictMode's double-mount the second run can
      // sample a node the first already hid — leaving it hidden for good.
      tl
        // Rings sweep in first and keep turning under everything else.
        .fromTo('[data-w="ring-outer"]',
          { strokeDashoffset: 760, opacity: 0, rotate: -90, transformOrigin: '50% 50%' },
          { strokeDashoffset: 0, opacity: 1, rotate: 0, duration: 1.5, ease: 'power2.inOut' })
        .fromTo('[data-w="ring-inner"]',
          { strokeDashoffset: -520, opacity: 0, rotate: 90, transformOrigin: '50% 50%' },
          { strokeDashoffset: 0, opacity: 1, rotate: 0, duration: 1.4, ease: 'power2.inOut' }, '<0.1')
        // Then the mark resolves out of the blur at the centre of them.
        .fromTo('[data-w="mark"]',
          { opacity: 0, scale: 0.7, filter: 'blur(14px)' },
          { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.9 }, '<0.35')
        .fromTo('[data-w="bloom"]',
          { opacity: 0, scale: 0.4 },
          { opacity: 1, scale: 1, duration: 0.8 }, '<')
        .fromTo('[data-w="rule"]',
          { scaleX: 0 },
          { scaleX: 1, duration: 0.6, transformOrigin: 'center' }, '-=0.45')
        // Letter by letter, so the greeting arrives rather than appearing.
        .fromTo('[data-w="char"]',
          { opacity: 0, y: 16, rotateX: -60 },
          { opacity: 1, y: 0, rotateX: 0, duration: 0.5, stagger: 0.022 }, '-=0.35')
        // The sweep starts and ends off-screen, so it never parks mid-frame.
        .fromTo('[data-w="sweep"]',
          { xPercent: -160 },
          { xPercent: 260, duration: 1.2, ease: 'power2.inOut' }, '-=0.55')
        .fromTo('[data-w="progress"]',
          { scaleX: 0 },
          { scaleX: 1, duration: 0.9, ease: 'power2.inOut', transformOrigin: 'left center' }, '<0.05')

        // ── Exit ────────────────────────────────────────────────────────
        // The seam lights up first, then the two halves part along it. A fade
        // would dissolve into the page; this reveals it.
        .to('[data-w="content"]', { opacity: 0, scale: 1.08, duration: 0.4 }, '+=0.15')
        .fromTo('[data-w="seam"]',
          { scaleX: 0, opacity: 1 },
          { scaleX: 1, duration: 0.45, ease: 'power2.out' }, '<')
        .to('[data-w="top"]', { yPercent: -100, duration: 0.85, ease: 'power3.inOut' }, '-=0.1')
        .to('[data-w="bottom"]', { yPercent: 100, duration: 0.85, ease: 'power3.inOut' }, '<')
        .to('[data-w="seam"]', { opacity: 0, duration: 0.5 }, '<0.15');

      // Scale the finished timeline to exactly RUN_SECONDS. Tuning a dozen
      // individual durations to hit a total is how the overlaps drift out of
      // step; this keeps the choreography and just sets the tempo.
      tl.duration(RUN_SECONDS);

      // The rings keep rotating for the whole intro, independent of the
      // timeline, so the composition is never completely still.
      gsap.to('[data-w="ring-outer"]', {
        rotate: 360, duration: 24, ease: 'none', repeat: -1, transformOrigin: '50% 50%',
      });
      gsap.to('[data-w="ring-inner"]', {
        rotate: -360, duration: 18, ease: 'none', repeat: -1, transformOrigin: '50% 50%',
      });
      gsap.to('[data-w="spark"]', {
        opacity: 0.9, scale: 1.4, duration: 1.6, ease: 'sine.inOut',
        repeat: -1, yoyo: true, stagger: { each: 0.18, from: 'random' },
      });
    }, rootRef);

    // If the ticker never runs, the curtain must still lift.
    const safety = window.setTimeout(() => {
      setActive(false);
      signalWelcomeDone();
    }, (RUN_SECONDS + 2.5) * 1000);

    return () => {
      window.clearTimeout(safety);
      document.body.style.overflow = previousOverflow;
      ctx.revert();
    };
  }, [active]);

  // Any interaction jumps to the exit rather than cutting: a hard cut from a
  // black screen to the page is more jarring than the intro was.
  useEffect(() => {
    if (!active) return;
    const skip = () => {
      const tl = timeline.current;
      if (!tl) return;
      const exit = tl.duration() * 0.72;
      if (tl.time() < exit) tl.time(exit);
    };
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('pointerdown', skip, { once: true });
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [active]);

  if (!active) return null;

  const greeting = name ? `Welcome back, ${name}` : 'Your trust, a brighter tomorrow';

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] overflow-hidden"
      // Decorative and transient: nothing here is content, and the page it
      // covers is already in the accessibility tree behind it.
      aria-hidden
    >
      <div data-w="top" className="absolute inset-x-0 top-0 h-1/2 bg-[#080808]" />
      <div data-w="bottom" className="absolute inset-x-0 bottom-0 h-1/2 bg-[#080808]" />

      {/* The seam the two halves part along. */}
      <span
        data-w="seam"
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 opacity-0"
        style={{
          background: 'linear-gradient(90deg, transparent, #F5C34A 22%, #FFF3D0 50%, #F5C34A 78%, transparent)',
          boxShadow: '0 0 24px 3px rgba(245,195,74,.55)',
        }}
      />

      <div
        data-w="content"
        className="relative flex h-full flex-col items-center justify-center px-6 text-center"
      >
        {/* Warm pool so the mark is lit by the scene, not floating on black. */}
        <div
          data-w="bloom"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px]"
          style={{ background: 'radial-gradient(circle, rgba(217,166,46,.38), transparent 68%)' }}
        />

        {/* Rings, echoing the badge in the favicon. Dasharray equals the
            circumference so the stroke draws itself exactly once. */}
        <svg
          className="pointer-events-none absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 sm:h-[420px] sm:w-[420px]"
          viewBox="0 0 260 260"
          fill="none"
        >
          <defs>
            <linearGradient id="w-ring-a" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F5C34A" />
              <stop offset="55%" stopColor="#D9A62E" stopOpacity=".35" />
              <stop offset="100%" stopColor="#A87516" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="w-ring-b" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFF3D0" />
              <stop offset="45%" stopColor="#F5C34A" stopOpacity=".5" />
              <stop offset="100%" stopColor="#D9A62E" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* r=120 → circumference ≈ 754; r=82 → ≈ 515 */}
          <circle
            data-w="ring-outer"
            cx="130" cy="130" r="120"
            stroke="url(#w-ring-a)" strokeWidth="1.5" strokeLinecap="round"
            strokeDasharray="754"
          />
          <circle
            data-w="ring-inner"
            cx="130" cy="130" r="82"
            stroke="url(#w-ring-b)" strokeWidth="1" strokeLinecap="round"
            strokeDasharray="515" strokeDashoffset="0"
          />
        </svg>

        {/* Sparks pinned around the ring, breathing out of phase. */}
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <span
            key={angle}
            data-w="spark"
            className="pointer-events-none absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-gold opacity-0"
            style={{
              transform: `rotate(${angle}deg) translateY(-170px)`,
              boxShadow: '0 0 10px 2px rgba(245,195,74,.8)',
            }}
          />
        ))}

        <div data-w="mark" className="relative">
          <Logo className="h-14 sm:h-16" priority />
        </div>

        <span
          data-w="rule"
          className="relative mt-6 block h-px w-44 bg-gradient-to-r from-transparent via-accent to-transparent"
        />

        <p className="relative mt-5 flex flex-wrap justify-center text-[11px] uppercase tracking-[0.34em] text-silver/75 sm:text-sm">
          {/* Split per character so the greeting can stagger. A non-breaking
              space keeps the words apart when the spans are inline-block. */}
          {greeting.split('').map((char, i) => (
            <span key={i} data-w="char" className="inline-block">
              {char === ' ' ? ' ' : char}
            </span>
          ))}
        </p>

        <span
          data-w="progress"
          className="relative mt-9 block h-[2px] w-32 rounded-full"
          style={{
            background: 'linear-gradient(90deg, #A87516, #F5C34A)',
            boxShadow: '0 0 14px 1px rgba(245,195,74,.5)',
          }}
        />
      </div>

      {/* The highlight passes over the whole composition. */}
      <span
        data-w="sweep"
        className="pointer-events-none absolute inset-y-0 left-0 w-1/4 -skew-x-12"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(245,195,74,.14), transparent)' }}
      />
    </div>
  );
}
