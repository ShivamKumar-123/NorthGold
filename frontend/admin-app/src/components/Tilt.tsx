'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Tilts its child toward the pointer in 3D, with a specular highlight that
 * tracks the cursor across the surface.
 *
 * Written straight to CSS custom properties inside a rAF, so a pointer move
 * never triggers a React render — at 120Hz over a grid of cards, re-rendering
 * per event is what makes this kind of effect feel sticky.
 */
export default function Tilt({
  children,
  max = 8,
  lift = 14,
  perspective = 900,
  sheen = true,
  className = '',
  disabled = false,
}: {
  children: ReactNode;
  /** Peak rotation in degrees at the card's edge. Past ~10 it reads as a gimmick. */
  max?: number;
  /** How far the card rises toward the viewer, in px. */
  lift?: number;
  perspective?: number;
  sheen?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const [enabled, setEnabled] = useState(false);

  // Only on devices with a real pointer, and only when motion is welcome.
  useEffect(() => {
    if (disabled || typeof window === 'undefined' || !window.matchMedia) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');

    const sync = () => setEnabled(fine.matches && !calm.matches);
    sync();

    fine.addEventListener('change', sync);
    calm.addEventListener('change', sync);
    return () => {
      fine.removeEventListener('change', sync);
      calm.removeEventListener('change', sync);
    };
  }, [disabled]);

  const reset = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    cancelAnimationFrame(frame.current);
    node.dataset.active = 'false';
    node.style.setProperty('--tilt-x', '0deg');
    node.style.setProperty('--tilt-y', '0deg');
    node.style.setProperty('--tilt-z', '0px');
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const node = ref.current;
      if (!node || !enabled) return;

      const rect = node.getBoundingClientRect();
      // -0.5 … 0.5 from the card's centre.
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;

      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        node.dataset.active = 'true';
        // Pointer below centre tips the top toward you, hence the negation.
        node.style.setProperty('--tilt-x', `${(-py * max).toFixed(2)}deg`);
        node.style.setProperty('--tilt-y', `${(px * max).toFixed(2)}deg`);
        node.style.setProperty('--tilt-z', `${lift}px`);
        if (sheen) {
          node.style.setProperty('--sheen-x', `${((px + 0.5) * 100).toFixed(1)}%`);
          node.style.setProperty('--sheen-y', `${((py + 0.5) * 100).toFixed(1)}%`);
        }
      });
    },
    [enabled, max, lift, sheen],
  );

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <div
      ref={ref}
      className={`tilt-root ${className}`}
      style={{ ['--tilt-perspective' as string]: `${perspective}px` }}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      onPointerCancel={reset}
      data-active="false"
    >
      {children}
      {sheen && enabled && <span className="tilt-sheen" aria-hidden />}
    </div>
  );
}
