import { useEffect, useRef, useState } from 'react';

/**
 * The hero visual: the card render floating in a 3D scene.
 *
 * The scene follows the pointer when there is one, and otherwise holds a fixed
 * three-quarter view so the depth still reads on touch and in screenshots.
 *
 * It used to carry three data panels — network total, this month's payout, a
 * peak rate badge — layered around the card. They were invented figures
 * dressed as live ones, and they crowded the artwork; the card alone is the
 * stronger image, and the real numbers live further down the page where they
 * come with their terms.
 */
export default function HeroScene() {
  const ref = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setInteractive(fine.matches && !calm.matches);
    sync();
    fine.addEventListener('change', sync);
    calm.addEventListener('change', sync);
    return () => {
      fine.removeEventListener('change', sync);
      calm.removeEventListener('change', sync);
    };
  }, []);

  // Tracked across the whole viewport — the card should acknowledge the
  // cursor before it arrives over the artwork.
  useEffect(() => {
    if (!interactive) return;
    const node = ref.current;
    if (!node) return;

    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const px = event.clientX / window.innerWidth - 0.5;
        const py = event.clientY / window.innerHeight - 0.5;
        node.style.setProperty('--scene-y', `${(px * 15).toFixed(2)}deg`);
        node.style.setProperty('--scene-x', `${(-py * 9).toFixed(2)}deg`);
      });
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame.current);
    };
  }, [interactive]);

  return (
    <div className="perspective-lg relative mx-auto w-full max-w-[600px] px-4 py-6 sm:px-6" aria-hidden>
      <div
        ref={ref}
        className="preserve-3d relative"
        style={{
          transform: 'rotateX(var(--scene-x, 4deg)) rotateY(var(--scene-y, -9deg))',
          transition: 'transform 300ms cubic-bezier(.22,1,.36,1)',
        }}
      >
        {/* Warm pool of light beneath, so the card sits ON something. */}
        <div
          className="pointer-events-none absolute inset-x-10 bottom-4 h-24 rounded-[50%] blur-3xl"
          style={{
            transform: 'translateZ(-90px)',
            background: 'radial-gradient(ellipse, rgba(217,166,46,.45), transparent 70%)',
          }}
        />

        {/* Two sources, not one: the pair render is a wide 3:2 that shrinks to
            nothing in a phone-width column, so narrow viewports get the
            upright render instead. */}
        <div className="relative animate-float" style={{ animationDuration: '9s' }}>
          <picture>
            <source media="(min-width: 640px)" srcSet="/images/cards/card-pair.webp" />
            <img
              src="/images/cards/card-upright.webp"
              alt=""
              width={1400}
              height={933}
              className="mx-auto w-full max-w-[280px] drop-shadow-[0_40px_70px_rgba(0,0,0,.8)] sm:max-w-none"
              // The largest paint on the page — never lazy, always first.
              loading="eager"
              decoding="async"
            />
          </picture>
        </div>
      </div>
    </div>
  );
}
