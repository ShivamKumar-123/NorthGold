import { useLayoutEffect } from 'react';
import { gsap } from 'gsap';

/**
 * Entrance choreography for the sign-in / sign-up screens.
 *
 * No ScrollTrigger here — an auth screen is one viewport and never scrolls on
 * desktop, so everything plays on load.
 *
 * ── Why `fromTo` and not `from` ────────────────────────────────────────────
 * `gsap.from()` SAMPLES the end value out of the DOM when the tween is built.
 * React StrictMode mounts every effect twice in development: the first run
 * writes `opacity: 0` onto the fields, and if the second run samples before
 * the revert has settled it records 0 as the destination too. The tween then
 * animates 0 → 0 and the element — in practice the submit button, the last in
 * the stagger — stays invisible for good.
 *
 * `fromTo` states both ends, so nothing is ever sampled and no previous run
 * can poison the next one. Worth the extra characters on any animation that
 * hides something the user needs to click.
 *
 * The markup renders in its final state and this hides it in a layout effect,
 * which React flushes before the browser paints — so a blocked bundle or a
 * reduced-motion setting leaves a complete, usable form rather than an
 * invisible one.
 */
export default function AuthMotion() {
  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ease = 'power3.out';
    let tl: gsap.core.Timeline | undefined;

    const ctx = gsap.context(() => {
      tl = gsap.timeline({ defaults: { ease, duration: 0.8 } });

      tl.fromTo('[data-auth="brand"] > *',
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.08, duration: 0.6 })
        .fromTo('[data-auth="pitch"] > *',
          { y: 22, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.09 }, '-=0.35')
        // The card arrives as an object: it scales up from slightly back in Z
        // rather than sliding, so it reads as landing on the page.
        .fromTo('[data-auth="card"]',
          { y: 26, opacity: 0, scale: 0.97 },
          { y: 0, opacity: 1, scale: 1, duration: 0.9 }, '-=0.5')
        .fromTo('[data-auth="field"]',
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.07, duration: 0.55 }, '-=0.55')
        // She points at the form, so she must not arrive before it exists.
        .fromTo('[data-auth="figure"]',
          { x: -40, opacity: 0 },
          { x: 0, opacity: 1, duration: 1.1 }, '-=0.9');
    });

    // Belt and braces: if the ticker never runs — a backgrounded tab on first
    // paint, a device that starves rAF — jump to the end rather than leave a
    // form nobody can submit.
    const safety = window.setTimeout(() => {
      if (tl && !tl.isActive() && tl.progress() < 1) tl.progress(1);
    }, 3500);

    return () => {
      window.clearTimeout(safety);
      ctx.revert();
    };
  }, []);

  return null;
}
