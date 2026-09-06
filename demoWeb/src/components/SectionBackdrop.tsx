/**
 * The photographic backdrop used behind alternating landing sections.
 *
 * Both source photos are bright — a golden sunrise — so they are dimmed hard
 * and then covered by a gradient that fades to solid Deep Black at the top and
 * bottom edges. Without that fade the image would end in a hard horizontal
 * seam against the next (plain) section, which is exactly what the alternating
 * rhythm is meant to avoid.
 */
export default function SectionBackdrop({
  variant = 'body',
  /**
   * 0-1, applied to the photo BEFORE the overlay. The two multiply, so the
   * visible strength is roughly `opacity × (1 - overlay alpha)` — at 0.14
   * under a 0.72 wash the photo landed near 4% and read as a vignette rather
   * than an image.
   */
  opacity = 0.32,
}: {
  variant?: 'body' | 'hero';
  opacity?: number;
}) {
  const hero = variant === 'hero';

  return (
    <>
      <img
        src={hero ? '/images/bg/hero.webp' : '/images/bg/body.webp'}
        alt=""
        width={1920}
        height={1080}
        loading={hero ? 'eager' : 'lazy'}
        decoding="async"
        className="pointer-events-none absolute inset-0 -z-30 h-[130%] w-full object-cover"
        style={{ opacity }}
        /* Drifts against the scroll — LandingMotion picks this up. Sized at
           130% so the travel never exposes the edge of the photo. */
        data-parallax="0.12"
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute inset-0 -z-20 ${hero ? 'scrim-hero' : 'scrim-body'}`}
        aria-hidden
      />
    </>
  );
}
