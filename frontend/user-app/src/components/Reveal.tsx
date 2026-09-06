import type { ElementType, ReactNode } from 'react';

/**
 * Marks a block for the landing page's scroll animation.
 *
 * It renders nothing of its own beyond a class and a stagger hint —
 * LandingMotion.tsx picks every `.reveal` up in one ScrollTrigger batch. A
 * per-element IntersectionObserver used to live here, which meant 22 separate
 * observers on the landing page and two animation systems fighting over the
 * same `transform` once GSAP arrived.
 *
 * The default state is VISIBLE. GSAP hides the block itself once it has
 * loaded, so a failed bundle leaves a readable page rather than a blank one.
 */
export default function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  as?: ElementType;
  /** Stagger, in ms, relative to the other blocks entering with it. */
  delay?: number;
  className?: string;
}) {
  return (
    <Tag className={`reveal ${className}`} data-reveal-delay={delay || undefined}>
      {children}
    </Tag>
  );
}
