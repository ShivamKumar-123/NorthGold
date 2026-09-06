/**
 * Wavy boundary between a solid section and one that reveals the page
 * backdrop.
 *
 * The wave is filled with the page's own background colour, so it reads as the
 * SOLID section spilling over into the transparent one — not as a decorative
 * shape floating on top. A hairline gold gradient traces the crest.
 */
export default function WaveDivider({
  position,
  className = '',
}: {
  /** `top` caps the section from above; `bottom` closes it from below. */
  position: 'top' | 'bottom';
  className?: string;
}) {
  const top = position === 'top';

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 z-10 h-[70px] overflow-hidden
                  ${top ? 'top-0' : 'bottom-0'} ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 1440 70"
        preserveAspectRatio="none"
        className={`wave-svg h-full w-full ${top ? '' : 'rotate-180'}`}
      >
        <defs>
          <linearGradient id={`wave-edge-${position}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#D9A62E" stopOpacity="0" />
            <stop offset="35%" stopColor="#F5C34A" stopOpacity="0.55" />
            <stop offset="65%" stopColor="#D9A62E" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#A87516" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Filled body: the solid section bleeding down into this one. */}
        <path
          d="M0,0 L1440,0 L1440,30 C1200,64 1040,4 780,26 C540,46 380,10 160,34 C90,42 40,40 0,34 Z"
          className="wave-fill"
        />
        {/* Crest highlight — the same curve, stroked. */}
        <path
          d="M1440,30 C1200,64 1040,4 780,26 C540,46 380,10 160,34 C90,42 40,40 0,34"
          fill="none"
          stroke={`url(#wave-edge-${position})`}
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
