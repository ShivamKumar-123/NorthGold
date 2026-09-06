import { Handshake, Lightbulb, ShieldCheck, Target, TrendingUp, Users } from 'lucide-react';

import Reveal from '@/components/Reveal';
import SplitWords from '@/components/SplitWords';

const POINTS = [
  {
    icon: TrendingUp,
    title: 'Empowering Financial Growth',
    body: 'Driving sustainable wealth creation through innovative investment strategies.',
  },
  {
    icon: Users,
    title: 'Client-Centric Excellence',
    body: "Delivering unparalleled service and tailored solutions to meet our clients' unique financial goals.",
  },
  {
    icon: ShieldCheck,
    title: 'Integrity and Transparency',
    body: 'Upholding the highest standards of ethics and accountability in all our financial operations.',
  },
  {
    icon: Target,
    title: 'Maximize Client Returns',
    body: 'Strategically manage investments to achieve optimal financial performance for our clients.',
  },
  {
    icon: Lightbulb,
    title: 'Innovate and Adapt',
    body: 'Continuously enhance our services through cutting-edge technology and market insights.',
  },
  {
    icon: Handshake,
    title: 'Build Long-Term Relationships',
    body: 'Foster trust and loyalty by prioritizing client needs and delivering consistent results.',
  },
];

/**
 * The vision band, sitting directly above the return schedule.
 *
 * Deliberately animated by the page-level controller rather than by its own
 * timeline: the `data-anim` hooks below are the same ones LandingMotion
 * already looks for, so the heading sequences and the six points stagger in
 * step with every other section instead of arriving on their own clock.
 *
 * The grid is `items-center` rather than stretched. The photograph is a 3:2
 * landscape and the list beside it is considerably taller; forcing the image
 * to fill that height would crop straight through the two people in it.
 */
export default function VisionSection() {
  return (
    <section id="vision" className="relative isolate overflow-hidden border-b border-border bg-bg">
      {/* Warm wash behind the photograph so the frame does not sit on a flat
          slab. Decorative, and outside the flow so it can never shift text. */}
      <div
        className="pointer-events-none absolute -left-40 top-1/4 h-[520px] w-[520px] rounded-full opacity-30 blur-[130px]"
        style={{ background: 'radial-gradient(circle, rgba(217,166,46,.5), transparent 70%)' }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          {/* ── Photograph ───────────────────────────────────────────── */}
          <Reveal>
            <figure className="relative">
              {/* Gold edge behind the frame — offset, so it reads as a lit
                  edge rather than as a border drawn around the picture. */}
              <span
                className="absolute -inset-px -z-10 rounded-3xl bg-gradient-to-br from-accent/60 via-accent/10 to-transparent"
                aria-hidden
              />
              <div className="overflow-hidden rounded-3xl border border-border shadow-e4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/people/vision.webp"
                  alt="Two NorthGold analysts reviewing live market data together"
                  width={1536}
                  height={1024}
                  loading="lazy"
                  decoding="async"
                  className="w-full"
                />
              </div>
            </figure>
          </Reveal>

          {/* ── Copy ─────────────────────────────────────────────────── */}
          <div>
            <div data-anim="head">
              <p className="eyebrow" data-head="eyebrow">
                What drives us
              </p>
              <h2 className="mt-3 text-display-sm font-semibold tracking-tight text-3d" data-head="title">
                <SplitWords text="Our Vision" />
              </h2>
              <span
                className="mt-4 block h-px w-24 bg-gradient-to-r from-accent to-transparent"
                data-head="rule"
                aria-hidden
              />
            </div>

            <ul className="mt-8 space-y-5" data-anim="stagger">
              {POINTS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3.5">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent">
                    <Icon size={14} />
                  </span>
                  <p className="text-sm leading-relaxed text-text-muted">
                    <span className="font-semibold text-text">{title}:</span> {body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
