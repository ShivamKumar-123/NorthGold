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
          { x: 0, opacity: 1, duration: 1.1 }, '-=0.9')
        .fromTo('[data-auth="trust"]',
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6 }, '-=0.8');

      // ── Ambient, and endless ────────────────────────────────────────
      // Deliberately NOT part of the timeline above. The safety net below
      // snaps that timeline to its end if the ticker never runs; doing the
      // same to an infinite tween would freeze it mid-drift instead.
      gsap.to('[data-auth="orb"]', {
        xPercent: (i) => (i % 2 ? -9 : 8),
        yPercent: (i) => (i % 2 ? 7 : -6),
        duration: 11,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        stagger: 1.4,
      });

      // The ring turns behind the card, so its gradient never settles into a
      // shape the eye can pin down.
      gsap.to('[data-auth="ring"]', {
        rotate: 360,
        duration: 28,
        ease: 'none',
        repeat: -1,
        transformOrigin: '50% 50%',
      });

      // A light crossing the card. Long gap between passes: often enough to
      // notice, rare enough not to nag.
      gsap.fromTo('[data-auth="sweep"]',
        { xPercent: 0 },
        {
          xPercent: 520,
          duration: 1.9,
          ease: 'power2.inOut',
          repeat: -1,
          repeatDelay: 5.5,
          delay: 1.1,
        });
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
