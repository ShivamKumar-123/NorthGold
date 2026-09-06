'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { BadgeCheck, Banknote, TrendingUp, Users, X } from 'lucide-react';

import { OPEN_STEPS, WELCOME_DONE, welcomeHasFinished } from '@/lib/welcomeSignal';

const SESSION_KEY = 'ng_steps_seen_v1';

const STEPS = [
  {
    icon: Users,
    title: 'Open an account',
    body: 'Register in a minute. A referral link links you into your sponsor’s network automatically.',
  },
  {
    icon: Banknote,
    title: 'Deposit',
    body: 'Bank transfer, UPI, crypto — or cash, where you describe the handover and our team verifies it.',
  },
  {
    icon: BadgeCheck,
    title: 'We verify',
    body: 'An administrator checks the payment against your message and reference before anything is credited.',
  },
  {
    icon: TrendingUp,
    title: 'Earn monthly',
    body: 'Your return is credited on each monthly anniversary of your deposit, at that month’s contracted rate.',
  },
];

/**
 * The four steps, as a panel that follows the welcome curtain.
 *
 * It used to be a band in the middle of the landing page, where it competed
 * with the pitch around it. Arriving once, on the way in, is when someone is
 * actually asking how this works.
 *
 * Once per session, and only automatically — `openSteps()` reopens it on
 * demand from anywhere, which is what the "Get started" button uses. Without
 * that the panel would be unrepeatable, and an explainer nobody can get back
 * to is worse than no explainer.
 */
export default function HowItWorksModal() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);

  const close = useCallback(() => {
    const tl = timeline.current;
    // Play the entrance backwards rather than cutting: the panel arrived with
    // weight, and vanishing instantly reads as a crash.
    if (tl) {
      tl.eventCallback('onReverseComplete', () => setOpen(false));
      tl.reverse();
    } else {
      setOpen(false);
    }
  }, []);

  // Automatic opening, once, after the curtain clears.
  useEffect(() => {
    const onDone = () => {
      try {
        if (sessionStorage.getItem(SESSION_KEY)) return;
      } catch {
        // Storage blocked. Showing it once per page load beats never showing
        // it — this is the explainer, not an interruption.
      }
      setOpen(true);
    };
    const onAsk = () => setOpen(true);

    window.addEventListener(WELCOME_DONE, onDone);
    window.addEventListener(OPEN_STEPS, onAsk);
    // The curtain fires from a layout effect, which runs before this passive
    // one — so on the paths where it never plays, the signal is already past
    // by the time we subscribe. Ask whether it happened rather than waiting
    // for an event that has been and gone.
    if (welcomeHasFinished()) onDone();
    return () => {
      window.removeEventListener(WELCOME_DONE, onDone);
      window.removeEventListener(OPEN_STEPS, onAsk);
    };
  }, []);

  // Escape closes it, and the page behind must not scroll under the panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;

    try {
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      /* nothing to remember it with */
    }

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (calm) return;

    const ctx = gsap.context(() => {
      // `fromTo` throughout — a `from` tween samples its end value from the
      // DOM, and StrictMode's double mount can sample a node the first run
      // already hid, leaving it hidden for good.
      const tl = gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .fromTo('[data-steps="scrim"]', { opacity: 0 }, { opacity: 1, duration: 0.35 })
        .fromTo(
          '[data-steps="panel"]',
          { opacity: 0, y: 40, scale: 0.94, rotateX: -8 },
          { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 0.7 },
          '-=0.15',
        )
        .fromTo(
          '[data-steps="step"]',
          { opacity: 0, y: 24, rotateX: -18 },
          { opacity: 1, y: 0, rotateX: 0, duration: 0.55, stagger: 0.08 },
          '-=0.35',
        );
      timeline.current = tl;
    }, rootRef);

    return () => {
      timeline.current = null;
      ctx.revert();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[120] grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="steps-title"
    >
      {/* Clicking away closes it. A modal with no way out but one small
          button is a trap on a phone. */}
      <button
        type="button"
        data-steps="scrim"
        onClick={close}
        aria-label="Close"
        className="absolute inset-0 h-full w-full cursor-default bg-black/75 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        data-steps="panel"
        className="on-dark relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10
                   bg-[#101010] p-6 shadow-e4 sm:p-9"
        style={{ perspective: 1000 }}
      >
        <span
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-50 blur-[90px]"
          style={{ background: 'radial-gradient(circle, rgba(217,166,46,.55), transparent 70%)' }}
          aria-hidden
        />

        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/12
                     text-text-muted transition hover:border-accent/50 hover:text-text"
        >
          <X size={16} />
        </button>

        <div className="relative text-center">
          <p className="eyebrow">How it works</p>
          <h2 id="steps-title" className="mt-3 text-3xl font-semibold tracking-tight text-text sm:text-4xl">
            Four steps, <span className="text-gradient-gold">no surprises</span>
          </h2>
          <span
            className="mx-auto mt-4 block h-px w-24 bg-gradient-to-r from-accent to-transparent"
            aria-hidden
          />
        </div>

        <ol className="relative mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* The rail behind the numbers, drawn only where all four sit in a
              row — at narrower widths it would cut through the copy. */}
          <span
            className="pointer-events-none absolute left-0 right-0 top-[30px] hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent lg:block"
            aria-hidden
          />
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} data-steps="step" className="relative text-center">
              <span
                className="relative z-10 mx-auto grid h-[60px] w-[60px] place-items-center rounded-2xl border border-white/12 text-base font-bold text-accent shadow-e3"
                style={{ background: 'linear-gradient(168deg,#242422,#111110)' }}
              >
                {i + 1}
              </span>
              <span className="mt-5 block text-text-muted">
                <Icon size={16} className="mx-auto" />
              </span>
              <h3 className="mt-3 font-semibold text-text">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{body}</p>
            </li>
          ))}
        </ol>

        <div className="relative mt-9 text-center">
          <button type="button" onClick={close} className="btn-primary px-7 py-3 text-base">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
