import Reveal from '@/components/Reveal';
import Tilt from '@/components/Tilt';
import WaveDivider from '@/components/WaveDivider';
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

/** Financial centres. The country is what the label leads with — the section
 *  is about which countries this reaches, so the city is the detail. */
const MARKERS: Array<{ city: string; country: string; lat: number; lon: number }> = [
  { city: 'Toronto', country: 'Canada', lat: 43.7, lon: -79.4 },
  { city: 'New York', country: 'United States', lat: 40.7, lon: -74.0 },
  { city: 'Mexico City', country: 'Mexico', lat: 19.4, lon: -99.1 },
  { city: 'São Paulo', country: 'Brazil', lat: -23.5, lon: -46.6 },
  { city: 'Buenos Aires', country: 'Argentina', lat: -34.6, lon: -58.4 },
  { city: 'London', country: 'United Kingdom', lat: 51.5, lon: -0.1 },
  { city: 'Frankfurt', country: 'Germany', lat: 50.1, lon: 8.7 },
  { city: 'Dubai', country: 'United Arab Emirates', lat: 25.2, lon: 55.3 },
  { city: 'Mumbai', country: 'India', lat: 19.1, lon: 72.9 },
  { city: 'Singapore', country: 'Singapore', lat: 1.35, lon: 103.8 },
  { city: 'Hong Kong', country: 'Hong Kong SAR', lat: 22.3, lon: 114.2 },
  { city: 'Sydney', country: 'Australia', lat: -33.9, lon: 151.2 },
];

const place = (lat: number, lon: number) => ({
  left: `${((lon + 180) / 360) * 100}%`,
  top: `${((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * 100}%`,
});

export default function GlobalPresence() {
  return (
    <section id="presence" className="relative isolate overflow-hidden border-b border-border bg-bg">
      <WaveDivider position="top" />
      <WaveDivider position="bottom" />
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
            {/* Gentler than the other images on purpose. The tilt moves
                the map under the pointer, and the pins are hover targets
                sitting on it — at the tilt used elsewhere the pin slides out
                from under the cursor before its label can appear. A few
                degrees keeps the depth without fighting the pins. */}
            <Tilt max={3} lift={6} perspective={2000} sheen={false}>
              <div className="relative w-full" style={{ aspectRatio: '1856 / 728' }}>
              <img
                src="/images/bg/worldmap.webp"
                alt="World map marking the countries NorthGold operates in"
                width={1856}
                height={728}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-contain"
              />

              {MARKERS.map((marker, i) => (
                <span
                  key={marker.city}
                  // The hit area is 28px, not the 10px of the dot itself. The
                  // dot's glow makes it look far bigger than it is, so a
                  // target the size of the dot means the pointer lands next to
                  // the pin, on nothing, and no label ever appears.
                  className="group absolute z-10 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center"
                  style={place(marker.lat, marker.lon)}
                >
                  {/* The halo is a separate element from the dot: the ping
                      animation drives `transform`, which would otherwise wipe
                      out the centring translate on the dot itself. */}
                  <span className="pointer-events-none relative grid h-3 w-3 place-items-center">
                    <span
                      className="absolute h-full w-full animate-ping rounded-full bg-accent/70"
                      style={{ animationDelay: `${i * 0.35}s`, animationDuration: '2.8s' }}
                      aria-hidden
                    />
                    <span className="relative h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_10px_rgba(217,166,46,.9)] transition-transform duration-200 group-hover:scale-150" />
                  </span>

                  {/* Built rather than left to the browser's own `title`
                      tooltip, which takes about a second to appear — long
                      enough that most people have moved the pointer on. */}
                  <span
                    className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2
                               whitespace-nowrap rounded-lg border border-accent/30 bg-[#111110] px-2.5 py-1.5
                               text-center opacity-0 shadow-e3 transition-opacity duration-200
                               group-hover:opacity-100"
                    role="tooltip"
                  >
                    <span className="block text-[11px] font-semibold leading-tight text-accent">
                      {marker.country}
                    </span>
                    <span className="block text-[10px] leading-tight text-white/55">{marker.city}</span>
                  </span>
                </span>
              ))}
              </div>
            </Tilt>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
