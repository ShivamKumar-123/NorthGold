import { useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * The landing page's motion layer.
 *
 * One controller for the whole page rather than an animation per component:
 * ScrollTrigger keeps a single scroll listener and a shared layout cache, so
 * every reveal on the page costs one measurement pass instead of one observer
 * each, all recomputing on resize.
 *
 * `useLayoutEffect`, not `useEffect`, and a static import rather than a
 * dynamic one — both for the same reason. Every element renders in its final
 * state (so a failed bundle leaves a readable page) and this effect hides it
 * again before playing it in. Anything that lets the browser paint in between
 * shows the content, blanks it, then animates it back. A layout effect runs
 * before that paint, and a static import means GSAP is already parsed when it
 * does.
 *
 * Everything it hides is registered in `hidden` so the failsafe at the bottom
 * can put the page back if a single selector or plugin ever throws.
 */

const EASE = 'power3.out';

/** Images small enough to be an icon, a logo or a bullet glyph — animating
 *  these reads as jitter, not choreography. */
const MIN_IMAGE_PX = 140;

export default function LandingMotion() {
  useLayoutEffect(() => {
    // Not a soft preference: the parallax moves content under the cursor,
    // which is exactly what this setting exists to stop.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let hero: gsap.core.Timeline | undefined;
    // Every element this effect hides, so the failsafe can reveal them all.
    const hidden: Element[] = [];
    const hide = (targets: Element[], vars: gsap.TweenVars) => {
      if (!targets.length) return;
      gsap.set(targets, vars);
      hidden.push(...targets);
    };

    const ctx = gsap.context(() => {
      /* ── Hero ────────────────────────────────────────────────────────
         Plays on load, not on scroll: it is already in view, and a
         ScrollTrigger would fire it a frame late after layout settles. */
      // `fromTo`, never `from`: a `from` tween SAMPLES its end value out of the
      // DOM when it is built, and React StrictMode mounts every effect twice
      // in development. If the second run samples a node the first run already
      // set to `opacity: 0`, the tween animates 0 → 0 and that element stays
      // invisible for good. Stating both ends removes the sampling entirely.
      hero = gsap
        .timeline({ defaults: { ease: EASE, duration: 0.9 } })
        .fromTo('[data-anim="hero-chip"]',
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6 })
        // The greeting arrives as a widening line rather than a fade: the
        // tracking closing to its resting value is what makes it read as a
        // masthead settling in, not another paragraph appearing.
        .fromTo('[data-anim="hero-welcome"]',
          { y: 14, opacity: 0, letterSpacing: '0.42em' },
          { y: 0, opacity: 1, letterSpacing: '0.22em', duration: 0.75 }, '-=0.35')
        .fromTo(
          '[data-anim="hero-title"] .word',
          { yPercent: 115, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 1, stagger: 0.055 },
          '-=0.3',
        )
        .fromTo('[data-anim="hero-copy"]',
          { y: 22, opacity: 0 },
          { y: 0, opacity: 1 }, '-=0.65')
        .fromTo('[data-anim="hero-cta"] > *',
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.09 }, '-=0.6')
        .fromTo('[data-anim="hero-meta"] > *',
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, stagger: 0.06 }, '-=0.7')
        .fromTo(
          '[data-anim="hero-scene"]',
          { opacity: 0, scale: 0.94, rotateY: -12 },
          { opacity: 1, scale: 1, rotateY: 0, duration: 1.3 },
          '-=1.1',
        );

      /* ── Section headings ────────────────────────────────────────────
         Eyebrow, title words, rule and body copy play as ONE sequence per
         heading. Four independent reveals landing on the same trigger read
         as a flicker; a sequence reads as a heading arriving. */
      gsap.utils.toArray<HTMLElement>('[data-anim="head"]').forEach((head) => {
        const eyebrow = head.querySelectorAll('[data-head="eyebrow"]');
        const words = head.querySelectorAll('[data-head="title"] .word');
        const rule = head.querySelectorAll('[data-head="rule"]');
        const copy = head.querySelectorAll('[data-head="copy"]');

        hide([...eyebrow], { opacity: 0, y: 14 });
        hide([...words], { yPercent: 110, opacity: 0 });
        hide([...rule], { scaleX: 0, transformOrigin: 'left center' });
        hide([...copy], { opacity: 0, y: 18 });

        const tl = gsap.timeline({
          defaults: { ease: EASE },
          scrollTrigger: { trigger: head, start: 'top 82%', once: true },
        });

        if (eyebrow.length) tl.to(eyebrow, { opacity: 1, y: 0, duration: 0.5 });
        if (words.length) {
          tl.to(words, { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.045 }, '-=0.25');
        }
        if (rule.length) tl.to(rule, { scaleX: 1, duration: 0.8 }, '-=0.55');
        if (copy.length) tl.to(copy, { opacity: 1, y: 0, duration: 0.7 }, '-=0.6');
      });

      /* ── Generic blocks ──────────────────────────────────────────────
         `batch` groups everything crossing the fold in the same frame so
         they stagger together instead of animating one at a time. */
      const reveals = gsap.utils.toArray<HTMLElement>('.reveal');
      hide(reveals, { opacity: 0, y: 30 });
      ScrollTrigger.batch('.reveal', {
        start: 'top 88%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, { opacity: 1, y: 0, duration: 0.85, ease: EASE, stagger: 0.09, overwrite: true }),
      });

      /* ── Card grids ──────────────────────────────────────────────────
         Cards come in on a slight X-rotation from below, like a hand of
         cards being laid down. The parent carries `perspective` already. */
      gsap.utils.toArray<HTMLElement>('[data-anim="stagger"]').forEach((group) => {
        const items = Array.from(group.children);
        if (!items.length) return;
        hide(items, { opacity: 0, y: 44, rotateX: -14, transformOrigin: 'center bottom' });
        gsap.to(items, {
          opacity: 1,
          y: 0,
          rotateX: 0,
          duration: 0.85,
          ease: EASE,
          stagger: 0.09,
          scrollTrigger: { trigger: group, start: 'top 85%', once: true },
        });
      });

      /* ── Images ──────────────────────────────────────────────────────
         Every substantial image on the page gets the same treatment: a
         clip-path wipe upward while the picture itself settles back from a
         slight zoom, so the frame fills before the subject stops moving.

         Auto-selected rather than opt-in, with three exclusions that would
         each look wrong: anything already inside another timeline, the
         backdrops that are scroll-scrubbed instead, and anything icon-sized. */
      const claimed = '[data-anim="hero-scene"], [data-parallax], [data-anim="drift"], [data-anim="zoom"], .logo-base, .logo-alt';
      gsap.utils
        .toArray<HTMLImageElement>('section img, footer img')
        .filter((img) => !img.closest(claimed) && !img.matches(claimed))
        .filter((img) => {
          const box = img.getBoundingClientRect();
          if (Math.max(box.width, box.height) < MIN_IMAGE_PX) return false;
          // A full-bleed backdrop is sized by `inset-0`; wiping it would fight
          // the layout it is stretched to. Those get parallax or a zoom
          // instead, which is why they are tagged rather than swept up here.
          const pos = getComputedStyle(img).position;
          return pos !== 'absolute' && pos !== 'fixed';
        })
        .forEach((img) => {
          hide([img], { clipPath: 'inset(0% 0% 100% 0%)', scale: 1.14 });
          gsap.to(img, {
            clipPath: 'inset(0% 0% 0% 0%)',
            scale: 1,
            duration: 1.15,
            ease: 'power2.out',
            scrollTrigger: { trigger: img, start: 'top 92%', once: true },
          });
        });

      /* Full-bleed backdrops: a slow scrubbed push-in. They sit under three
         overlays, so a wipe would be invisible — a scale change still reads. */
      gsap.utils.toArray<HTMLElement>('[data-anim="zoom"]').forEach((img) => {
        gsap.fromTo(
          img,
          { scale: 1.02 },
          {
            scale: 1.2,
            ease: 'none',
            scrollTrigger: {
              trigger: img.parentElement ?? img,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      });

      /* ── Parallax ────────────────────────────────────────────────────
         `fromTo` around zero, not `to`: a one-way tween starts the layer at
         its natural position and only ever pushes it down, which uncovers a
         strip at the top of the section. Splitting the travel either side of
         centre keeps the frame filled throughout the scroll.
         `scrub: true` ties progress to scroll position, so the layer tracks
         the finger on a trackpad rather than easing along behind it. */
      gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((layer) => {
        const depth = Number(layer.dataset.parallax) || 0.12;
        gsap.fromTo(
          layer,
          { yPercent: -depth * 50 },
          {
            yPercent: depth * 50,
            ease: 'none',
            scrollTrigger: {
              trigger: layer.parentElement ?? layer,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      });

      /* ── Drifting decoration ─────────────────────────────────────────
         The floating card renders and similar loose artwork rise slowly as
         their section passes, which separates them from the flat content
         behind without asking for attention. */
      gsap.utils.toArray<HTMLElement>('[data-anim="drift"]').forEach((el) => {
        gsap.fromTo(
          el,
          { yPercent: 12 },
          {
            yPercent: -12,
            ease: 'none',
            scrollTrigger: {
              trigger: el.parentElement ?? el,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      });

      /* ── Table rows ──────────────────────────────────────────────────
         The commission table is the densest block on the page; sliding the
         rows in one by one gives the eye an order to read them in. */
      gsap.utils.toArray<HTMLElement>('.table-wrap table.data tbody').forEach((body) => {
        const rows = Array.from(body.children);
        if (!rows.length) return;
        hide(rows, { opacity: 0, x: -18 });
        gsap.to(rows, {
          opacity: 1,
          x: 0,
          duration: 0.55,
          ease: 'power2.out',
          stagger: 0.06,
          scrollTrigger: { trigger: body, start: 'top 88%', once: true },
        });
      });

      /* ── Footer ──────────────────────────────────────────────────────
         The footer is the one block every visitor reaches, and it arrives
         after a long scroll — so it gets its own sequence rather than being
         swept into the generic `.reveal` batch, which would land the CTA
         panel, four link columns and the risk notice all in the same frame. */
      const footCta = gsap.utils.toArray<HTMLElement>('[data-anim="foot-cta"]');
      hide(footCta, { opacity: 0, y: 34, scale: 0.985 });
      gsap.to(footCta, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.9,
        ease: EASE,
        scrollTrigger: { trigger: footCta[0] ?? 'footer', start: 'top 90%', once: true },
      });

      gsap.utils.toArray<HTMLElement>('[data-anim="foot-cols"]').forEach((cols) => {
        const columns = Array.from(cols.children);
        if (!columns.length) return;
        hide(columns, { opacity: 0, y: 26 });
        gsap.to(columns, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: EASE,
          stagger: 0.08,
          scrollTrigger: { trigger: cols, start: 'top 92%', once: true },
        });
      });

      gsap.utils.toArray<HTMLElement>('[data-anim="foot-social"]').forEach((row) => {
        const icons = Array.from(row.children);
        if (!icons.length) return;
        hide(icons, { opacity: 0, scale: 0.6 });
        gsap.to(icons, {
          opacity: 1,
          scale: 1,
          duration: 0.5,
          // A little overshoot: these are the only round objects down here and
          // a pop suits them where a fade would go unnoticed.
          ease: 'back.out(2)',
          stagger: 0.07,
          scrollTrigger: { trigger: row, start: 'top 95%', once: true },
        });
      });

      const footRule = gsap.utils.toArray<HTMLElement>('[data-anim="foot-rule"]');
      hide(footRule, { scaleX: 0, transformOrigin: 'left center' });
      gsap.to(footRule, {
        scaleX: 1,
        duration: 0.8,
        ease: 'power2.out',
        scrollTrigger: { trigger: footRule[0] ?? 'footer', start: 'top 95%', once: true },
      });

      /* ── Wave separators ─────────────────────────────────────────────
         A slow horizontal drift on the crest, so the boundary between two
         sections is never a static line. */
      gsap.utils.toArray<SVGElement>('svg.wave-svg').forEach((wave, i) => {
        gsap.to(wave, {
          xPercent: i % 2 ? 2.5 : -2.5,
          ease: 'none',
          scrollTrigger: {
            trigger: wave.parentElement ?? wave,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        });
      });
    });

    // Images finish decoding after hydration and change every offset below
    // them; without this the triggers fire at stale scroll positions.
    const onLoad = () => ScrollTrigger.refresh();
    window.addEventListener('load', onLoad);

    /* Failsafe. Everything above starts hidden, so anything that stops the
       ticker — a throttled background tab on first paint, a thrown plugin, a
       device that never fires rAF — would leave the page blank with no way
       back. Well past the longest sequence, force whatever is still hidden
       into view and finish the hero. */
    const safety = window.setTimeout(() => {
      if (hero && !hero.isActive() && hero.progress() < 1) hero.progress(1);

      // Only what is on screen: an element still hidden below the fold is
      // waiting its turn, not broken, and clearing it would spend the reveal
      // before the reader ever gets there.
      const stuck = hidden.filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return false;
        const opacity = Number(gsap.getProperty(el, 'opacity'));
        const clip = String(gsap.getProperty(el, 'clipPath') ?? '');
        const scaleX = Number(gsap.getProperty(el, 'scaleX'));
        return opacity < 1 || clip.includes('100%') || scaleX < 1;
      });
      if (stuck.length) gsap.set(stuck, { clearProps: 'all' });
    }, 5000);

    return () => {
      window.clearTimeout(safety);
      window.removeEventListener('load', onLoad);
      ctx.revert();
    };
  }, []);

  return null;
}
