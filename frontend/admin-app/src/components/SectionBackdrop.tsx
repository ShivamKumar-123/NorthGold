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
  /** 0-1. The body photo is busy behind text, so it stays very low. */
  opacity = 0.14,
}: {
  variant?: 'body' | 'hero';
  opacity?: number;
}) {
  const hero = variant === 'hero';

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={hero ? '/images/bg/hero.webp' : '/images/bg/body.webp'}
        alt=""
        width={1920}
        height={1080}
        loading={hero ? 'eager' : 'lazy'}
        decoding="async"
        className="pointer-events-none absolute inset-0 -z-30 h-full w-full object-cover"
        style={{ opacity }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          background: hero
            ? 'linear-gradient(180deg, rgba(8,8,8,.62) 0%, rgba(8,8,8,.45) 45%, rgba(8,8,8,.88) 100%)'
            : 'linear-gradient(180deg, #080808 0%, rgba(8,8,8,.72) 22%, rgba(8,8,8,.72) 78%, #080808 100%)',
        }}
        aria-hidden
      />
    </>
  );
}
