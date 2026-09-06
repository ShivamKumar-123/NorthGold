/**
 * One fixed backdrop for the whole landing page.
 *
 * Deliberately NOT one image per section: a fixed layer stays put while the
 * page scrolls, so each transparent section reveals a different part of the
 * same continuous photo. Repeating a per-section image instead restarts the
 * picture at every boundary, which is what makes that approach look like
 * wallpaper rather than a window.
 *
 * Sections that should hide it paint an opaque background (`bg-bg`); the ones
 * that reveal it stay transparent.
 *
 * NOTE: this only works because `body` carries no background — see the paint
 * order comment in globals.css. A background on `body` paints over anything at
 * a negative z-index.
 */
export default function PageBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-50" aria-hidden>
      <img
        src="/images/bg/body.webp"
        alt=""
        width={1920}
        height={1080}
        loading="eager"
        decoding="async"
        className="h-full w-full object-cover opacity-[0.45]"
      />
      {/* Scrim — the photo is a bright sunrise and every revealing section puts
          body copy straight on top of it. */}
      <div className="scrim-page absolute inset-0" />
      {/* Vignette so the edges fall away and the centre carries the image. */}
      <div className="scrim-vignette absolute inset-0" />
    </div>
  );
}
