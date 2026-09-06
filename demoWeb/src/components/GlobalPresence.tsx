import Reveal from '@/components/Reveal';
import SplitWords from '@/components/SplitWords';

/**
 * The projection the map image was drawn with. The pins are placed from these
 * same numbers, so the two agree by construction — change one without the
 * other and every marker moves into the sea.
 *
 * Antarctica and the far north are cropped, which is why the latitude window
 * is not a plain -90..90.
 */
const LAT_TOP = 84;
const LAT_BOTTOM = -58;

/** Financial centres, unlabelled — the same way the reference reads. */
const MARKERS: Array<{ name: string; lat: number; lon: number }> = [
  { name: 'Toronto', lat: 43.7, lon: -79.4 },
  { name: 'New York', lat: 40.7, lon: -74.0 },
  { name: 'Mexico City', lat: 19.4, lon: -99.1 },
  { name: 'São Paulo', lat: -23.5, lon: -46.6 },
  { name: 'Buenos Aires', lat: -34.6, lon: -58.4 },
  { name: 'London', lat: 51.5, lon: -0.1 },
  { name: 'Frankfurt', lat: 50.1, lon: 8.7 },
  { name: 'Dubai', lat: 25.2, lon: 55.3 },
  { name: 'Mumbai', lat: 19.1, lon: 72.9 },
  { name: 'Singapore', lat: 1.35, lon: 103.8 },
  { name: 'Hong Kong', lat: 22.3, lon: 114.2 },
  { name: 'Sydney', lat: -33.9, lon: 151.2 },
];

const place = (lat: number, lon: number) => ({
  left: `${((lon + 180) / 360) * 100}%`,
  top: `${((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * 100}%`,
});

export default function GlobalPresence() {
  return (
    <section id="presence" className="relative isolate overflow-hidden border-b border-border bg-bg">
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
          {/* ── Copy ─────────────────────────────────────────────────── */}
          <div data-anim="head">
            <p className="eyebrow" data-head="eyebrow">
              Where we operate
            </p>
            <h2 className="mt-3 text-display-sm font-semibold tracking-tight text-3d" data-head="title">
              <SplitWords text="Our Global Presence" />
            </h2>
            <span
              className="mt-4 block h-px w-24 bg-gradient-to-r from-accent to-transparent"
              data-head="rule"
              aria-hidden
            />
            <p className="mt-6 text-xl font-medium text-text" data-head="copy">
              Available in Multiple Countries.
            </p>
            <p className="mt-3 max-w-md leading-relaxed text-text-muted">
              We are providing our quality services from multiple locations and
              expanding to new locations as well.
            </p>
          </div>

          {/* ── Map ──────────────────────────────────────────────────── */}
          <Reveal delay={120}>
            {/* The wrapper keeps the image's exact aspect so the absolutely
                placed pins stay on their coordinates at every width. */}
            <div className="relative w-full" style={{ aspectRatio: '1856 / 728' }}>
              <img
                src="/images/bg/worldmap.webp"
                alt="World map with the regions NorthGold serves marked"
                width={1856}
                height={728}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain"
              />

              {MARKERS.map((marker, i) => (
                <span
                  key={marker.name}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={place(marker.lat, marker.lon)}
                  title={marker.name}
                >
                  {/* The halo is a separate element from the dot: the ping
                      animation drives `transform`, which would otherwise wipe
                      out the centring translate on the dot itself. */}
                  <span className="relative grid h-3 w-3 place-items-center">
                    <span
                      className="absolute h-full w-full animate-ping rounded-full bg-accent/70"
                      style={{ animationDelay: `${i * 0.35}s`, animationDuration: '2.8s' }}
                      aria-hidden
                    />
                    <span className="relative h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_rgba(217,166,46,.9)]" />
                  </span>
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
