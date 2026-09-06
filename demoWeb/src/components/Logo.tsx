/**
 * The NorthGold lockup.
 *
 * Two variants because the wordmark is 3:1 — below roughly 100px wide the
 * "NorthGold" text stops being legible, so tight spots (the mobile bar) get
 * the monogram on its own rather than an unreadable full lockup.
 *
 * Two *files* per variant, because the artwork is two-tone: a silver "North"
 * beside a gold "Gold". The silver half all but vanishes on an ivory surface,
 * so the light theme swaps in a recoloured copy whose grey ramp runs dark
 * instead of bright. Which one shows is decided in CSS (see `.logo-base` /
 * `.logo-alt` in globals.css) rather than from the theme hook — the sidebar
 * and the auth panel stay dark in BOTH themes, and a CSS rule can scope that
 * exception to any `.on-dark` island without every call site knowing.
 *
 * The image already contains the wordmark, so it carries the alt text and any
 * adjacent markup must NOT repeat the name.
 */
export default function Logo({
  variant = 'full',
  className = 'h-8',
  priority = false,
}: {
  variant?: 'full' | 'mark';
  /** Set a height; width follows from the intrinsic ratio. */
  className?: string;
  priority?: boolean;
}) {
  const mark = variant === 'mark';
  const base = mark ? '/images/brand/logo-mark.webp' : '/images/brand/logo.webp';
  const alt = mark ? '/images/brand/logo-mark-light.webp' : '/images/brand/logo-light.webp';
  const shared = `w-auto select-none ${className}`;
  const size = mark ? { width: 248, height: 256 } : { width: 720, height: 240 };

  return (
    <>
      <img
        src={base}
        alt="NorthGold"
        {...size}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={`logo-base ${shared}`}
        draggable={false}
      />
      {/* Decorative: the copy above already provides the accessible name, and
          exactly one of the two is ever visible. */}
      <img
        src={alt}
        alt=""
        aria-hidden
        {...size}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={`logo-alt ${shared}`}
        draggable={false}
      />
    </>
  );
}
