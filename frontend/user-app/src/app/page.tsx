import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Banknote,
  Lock, ShieldCheck, Sparkles, TrendingUp, Users,
} from 'lucide-react';

import HeroScene from '@/components/HeroScene';
import MarqueeTicker from '@/components/MarqueeTicker';
import ForexCrossRates from '@/components/ForexCrossRates';
import ForexRates from '@/components/ForexRates';
import GlobalPresence from '@/components/GlobalPresence';
import LandingMotion from '@/components/LandingMotion';
import CardPromo from '@/components/CardPromo';
import Reveal from '@/components/Reveal';
import SplitWords from '@/components/SplitWords';
import VisionSection from '@/components/VisionSection';
import PageBackdrop from '@/components/PageBackdrop';
import SectionBackdrop from '@/components/SectionBackdrop';
import WaveDivider from '@/components/WaveDivider';
import Tilt from '@/components/Tilt';
import { API_BASE, money, num } from '@/lib/api';
import type { RoiPlan } from '@/types';

// Rendered per request, NOT prerendered at build time: the API is not
// reachable during `next build` (and certainly not during a Docker image
// build), so a statically prerendered page would ship with an empty price
// board and empty plan cards until its first revalidation.
//
// The individual fetches below still hit the 60s data cache, so per-request
// rendering costs at most four upstream calls per minute, not per visitor.
export const dynamic = 'force-dynamic';

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // The API being unreachable must degrade the marketing page, not blank it.
    return null;
  }
}

export default async function LandingPage() {
  const plans = await fetchJson<RoiPlan[]>('/investments/plans/');

  const planList = plans ?? [];

  const entryPoint = planList.length
    ? Math.min(...planList.map((p) => Number(p.min_amount)))
    : 0;

  return (
    <>
      <LandingMotion />
      <PageBackdrop />

      {/* ══ Hero ═══════════════════════════════════════════════════════════ */}
      <section className="grain relative isolate overflow-hidden bg-bg">
        {/* Photo first, aurora on top of it — the blobs read as light
            spilling over the ridge rather than a separate gradient layer. */}
        <SectionBackdrop variant="hero" opacity={0.55} />
        <Aurora />
        <div className="grid-overlay" aria-hidden />
        <div className="grid-floor" aria-hidden />

        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-16 sm:px-6 lg:pb-16 lg:pt-24">
          <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
            {/* ── Copy ─────────────────────────────────────────────── */}
            <div className="text-center lg:text-left">
              {/* The hero is above the fold, so it is driven by the load
                  timeline in LandingMotion — not by `Reveal`, which waits for
                  a scroll that has not happened yet. */}
              <span className="chip mx-auto lg:mx-0" data-anim="hero-chip">
                <Sparkles size={12} className="text-gold" />
                Verified partner-bank instruments
                <span className="mx-1 h-3 w-px bg-white/15" />
                <span className="text-success">Monthly payouts</span>
              </span>

              {/* The greeting is its own line above the headline. Folding it
                  into the h1 would put a salutation inside the sentence the
                  page is actually there to make. */}
              <p
                className="mt-7 text-sm font-semibold uppercase tracking-[0.22em] text-gradient-gold"
                data-anim="hero-welcome"
              >
                Welcome to Net financing
              </p>

              {/* Solid body, gradient only on the phrase that matters.
                  Running .text-gradient across every span gives each its own
                  ramp, which turns the opening words muddy. */}
              <h1
                className="mt-3 text-balance text-display font-semibold text-text text-3d [overflow-wrap:break-word]"
                data-anim="hero-title"
              >
                <SplitWords text="Instant access to investing," />{' '}
                <SplitWords text="anytime and anywhere" className="text-gradient-gold" />
              </h1>

              <p
                className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-text-muted lg:mx-0"
                data-anim="hero-copy"
              >
                Invest in the most well-known and in-demand assets available.
                Using the device of your choosing, the platform has everything
                you could ever want in a perfect investing tool.
              </p>

              <div
                className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-text-dim lg:justify-start"
                data-anim="hero-meta"
              >
                <span className="flex items-center gap-1.5">
                  <Lock size={12} /> Admin-verified deposits
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={12} /> Terms frozen at purchase
                </span>
                <span className="flex items-center gap-1.5">
                  <Banknote size={12} /> From {money(entryPoint).replace('.00', '')}
                </span>
              </div>
            </div>

            {/* ── Card, and the calls to action above it ── */}
            <div className="relative">
              {/* The buttons moved out of the copy column and onto the card
                  column, so they read as the action attached to the product
                  shot rather than as a third line of text under a paragraph. */}
              <div
                className="relative z-10 flex flex-wrap items-center justify-center gap-3"
                data-anim="hero-cta"
              >
                <Link href="/register" className="btn-primary px-7 py-3.5 text-base">
                  Open an account
                  <ArrowRight size={17} />
                </Link>
                <Link href="/calculator" className="btn-ghost px-7 py-3.5 text-base">
                  See your returns
                </Link>
              </div>

              <div className="relative perspective-lg" data-anim="hero-scene">
                <HeroScene />
              </div>
            </div>
          </div>
        </div>

        {/* Lifted clear of the section's bottom edge. Flush against it the
            strip read as a border between two sections rather than as the
            closing band of the hero. */}
        <div className="relative pb-12 lg:pb-16">
          <MarqueeTicker />
        </div>
      </section>

      {/* ══ Card promo ═════════════════════════════════════════════════════ */}
      <CardPromo />

      {/* ══ Vision ═════════════════════════════════════════════════════════ */}
      <VisionSection />

      {/* ══ Plans ══════════════════════════════════════════════════════════ */}
      <section id="plans" className="relative isolate overflow-hidden border-b border-border">
        <WaveDivider position="top" />
        <WaveDivider position="bottom" />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(217,166,46,.12),transparent_70%)]"
          aria-hidden
        />
        {/* Decorative, and deliberately outside the flow: it must never push
            the heading around or intercept a click. */}
        <div
          className="pointer-events-none absolute -right-8 top-14 hidden w-[400px] rotate-6 opacity-90 2xl:block"
          data-anim="drift"
          aria-hidden
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/cards/card-hero.webp"
            alt=""
            width={1200}
            height={800}
            loading="lazy"
            decoding="async"
            className="w-full drop-shadow-[0_30px_60px_rgba(0,0,0,.7)]"
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <Reveal>
            <SectionHead
              eyebrow="Return schedule"
              title="Bigger deposit, higher tier. Longer hold, higher rate."
              description="Every plan pays a different percentage in each month of its term. Your amount picks the tier; time moves you along the curve."
              center
            />
          </Reveal>

          {planList.length === 0 ? (
            <EmptyNotice>No plans are published yet.</EmptyNotice>
          ) : (
            <div className="perspective-lg mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-anim="stagger">
              {planList.map((plan, i) => (
                <Reveal key={plan.id} delay={i * 90} className="h-full">
                  <PlanCard plan={plan} featured={i === planList.length - 1} />
                </Reveal>
              ))}
            </div>
          )}

          <Reveal delay={200}>
            <p className="mt-10 text-center text-sm text-text-dim">
              Terms are frozen onto your investment at purchase — a later plan
              edit never changes what you were promised.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══ Global presence ══════════════════════════════════════ */}
      <GlobalPresence />

      {/* ══ How it works ═══════════════════════════════════════════════════ */}
      <section className="border-b border-border bg-bg">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <Reveal>
            <SectionHead eyebrow="How it works" title="Four steps, no surprises" center />
          </Reveal>

          <ol className="perspective relative mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" data-anim="stagger">
            <span
              className="pointer-events-none absolute left-0 right-0 top-[30px] hidden h-px bg-gradient-to-r from-transparent via-border-strong to-transparent lg:block"
              aria-hidden
            />
            {[
              {
                icon: <Users size={16} />,
                title: 'Open an account',
                body: 'Register in a minute. A referral link links you into your sponsor’s network automatically.',
              },
              {
                icon: <Banknote size={16} />,
                title: 'Deposit',
                body: 'Bank transfer, UPI, crypto — or cash, where you describe the handover and our team verifies it.',
              },
              {
                icon: <BadgeCheck size={16} />,
                title: 'We verify',
                body: 'An administrator checks the payment against your message and reference before anything is credited.',
              },
              {
                icon: <TrendingUp size={16} />,
                title: 'Earn monthly',
                body: 'Your return is credited on each monthly anniversary of your deposit, at that month’s contracted rate.',
              },
            ].map((step, i) => (
              <Reveal key={step.title} as="li" delay={i * 110} className="relative">
                <div className="flex flex-col items-center text-center">
                  <span className="relative z-10 grid h-[60px] w-[60px] place-items-center rounded-2xl border border-border-strong text-base font-bold text-accent shadow-e3"
                        style={{ background: 'linear-gradient(168deg,#242422,#111110)' }}>
                    {i + 1}
                  </span>
                  <span className="mt-5 text-text-muted">{step.icon}</span>
                  <h3 className="mt-3 font-semibold text-text">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">{step.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ══ Live foreign exchange ════════════════════════════════ */}
      <ForexRates />
      <ForexCrossRates />

      {/* ══ CTA ════════════════════════════════════════════════════════════ */}
      <section className="relative isolate overflow-hidden">
        <WaveDivider position="top" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <Reveal>
            <div className="grain relative isolate overflow-hidden rounded-3xl border border-white/[0.08] px-6 py-16 text-center shadow-e4 sm:px-12">
              {/* This render ships with its own studio backdrop, so it works as
                  a bleed rather than a cut-out. The gradient over it keeps the
                  copy at full contrast. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/cards/card-angled.webp"
                alt=""
                width={1200}
                height={800}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 -z-20 h-full w-full scale-110 object-cover opacity-[0.22] blur-[3px]"
                data-anim="zoom"
              />
              {/* Two overlays, not one. The flat wash alone still left the
                  card's chip and logo reading THROUGH the heading; the radial
                  pass darkens the centre specifically, where the copy sits. */}
              <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(4,6,12,.78),rgba(4,6,12,.94))]" />
              <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_70%_at_50%_50%,rgba(4,6,12,.88),transparent_75%)]" />
              <div className="absolute inset-0 -z-10 bg-[radial-gradient(80%_120%_at_50%_0%,rgba(217,166,46,.22),transparent_65%)]" />
              <div className="grid-overlay opacity-50" aria-hidden />

              <h2 className="text-display-sm font-semibold text-text text-3d">
                Start earning <span className="text-gradient-gold">next month</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl leading-relaxed text-text-muted">
                Open an account, make your first deposit, and share your referral
                link to build a network that pays you every single month.
              </p>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Link href="/register" className="btn-primary px-7 py-3.5 text-base">
                  Open an account
                  <ArrowRight size={17} />
                </Link>
                <Link href="#plans" className="btn-ghost px-7 py-3.5 text-base">
                  Browse the plans
                </Link>
              </div>
              <p className="mt-8 text-xs leading-relaxed text-text-dim">
                Capital is at risk. Returns shown are the contracted schedule for
                each plan, not a guarantee of future performance.
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}

/* ── Pieces ──────────────────────────────────────────────────────────────── */

function Aurora() {
  return (
    <div className="aurora" aria-hidden>
      <div
        className="aurora__blob animate-drift-a"
        style={{
          left: '6%',
          top: '2%',
          width: '46vw',
          height: '46vw',
          background: 'radial-gradient(circle, rgba(217,166,46,.55), transparent 65%)',
        }}
      />
      <div
        className="aurora__blob animate-drift-b"
        style={{
          right: '2%',
          top: '-8%',
          width: '42vw',
          height: '42vw',
          background: 'radial-gradient(circle, rgba(184,115,51,.45), transparent 65%)',
        }}
      />
      <div
        className="aurora__blob animate-drift-a"
        style={{
          left: '36%',
          top: '36%',
          width: '34vw',
          height: '34vw',
          animationDelay: '-8s',
          background: 'radial-gradient(circle, rgba(217,166,46,.24), transparent 65%)',
        }}
      />
    </div>
  );
}

function SectionHead({
  eyebrow,
  title,
  description,
  center,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  center?: boolean;
  action?: React.ReactNode;
}) {
  return (
    // `data-anim="head"` marks the whole block: LandingMotion plays the eyebrow,
    // the title word by word, the rule and the description as one sequence
    // rather than as four unrelated reveals arriving at the same instant.
    <div
      className={center ? 'mx-auto max-w-3xl text-center' : 'flex flex-wrap items-end justify-between gap-4'}
      data-anim="head"
    >
      <div className={center ? '' : 'max-w-2xl'}>
        <p className="eyebrow" data-head="eyebrow">{eyebrow}</p>
        <h2 className="mt-3 text-display-sm font-semibold tracking-tight text-3d" data-head="title">
          <SplitWords text={title} />
        </h2>
        {/* Gold rule that draws itself in as the heading enters. */}
        <span
          className={`mt-4 block h-px w-24 bg-gradient-to-r from-accent to-transparent ${center ? 'mx-auto' : ''}`}
          data-head="rule"
          aria-hidden
        />
        {description && (
          <p className="mt-4 leading-relaxed text-text-muted" data-head="copy">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function PlanCard({ plan, featured }: { plan: RoiPlan; featured?: boolean }) {
  const first = plan.months[0]?.percent;
  const last = plan.months[plan.months.length - 1]?.percent;
  const peak = plan.months.reduce((m, row) => Math.max(m, Number(row.percent)), 0);

  return (
    <Tilt max={7} lift={18} className="h-full">
      <div
        className={`preserve-3d group relative flex h-full flex-col rounded-2xl p-6 shadow-e2
                    transition-shadow duration-300 hover:shadow-e4
                    ${featured ? 'border-gradient-gold underglow' : 'border-gradient'}`}
        style={featured ? ({ ['--underglow' as string]: 'rgba(217,166,46,.55)' }) : undefined}
      >
        {featured && (
          <span className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-gradient-to-b from-[#F5C34A] to-[#A87516] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-bg shadow-e2">
            Highest yield
          </span>
        )}

        <div className="layer-1">
          <h3 className="text-lg font-semibold">{plan.name}</h3>
          <p className="mt-1 text-xs text-text-muted">
            {money(plan.min_amount).replace('.00', '')} –{' '}
            {plan.max_amount ? money(plan.max_amount).replace('.00', '') : 'no cap'}
          </p>
        </div>

        <div className="mt-6 layer-2">
          <span
            className={`text-4xl font-semibold tracking-tight ${
              featured ? 'text-gradient-gold' : 'text-text'
            }`}
          >
            {num(plan.total_return_percent, 2)}%
          </span>
          <p className="mt-1 text-xs text-text-dim">total over {plan.tenure_months} months</p>
        </div>

        {/* Month curve — a tiny bar chart says "the rate ramps" faster than a
            sentence does. */}
        <div className="mt-6 flex h-14 items-end gap-[3px] layer-1" aria-hidden>
          {plan.months.map((m) => {
            const height = peak > 0 ? (Number(m.percent) / peak) * 100 : 0;
            return (
              <span
                key={m.month_index}
                className={`flex-1 rounded-sm transition-all duration-500 ${
                  featured
                    ? 'bg-gradient-to-t from-gold-deep/50 to-gold group-hover:from-gold-deep group-hover:to-[#F5C34A]'
                    : 'bg-gradient-to-t from-accent/30 to-accent/80 group-hover:to-accent'
                }`}
                style={{ height: `${Math.max(height, 8)}%` }}
              />
            );
          })}
        </div>

        {first && last && (
          <p className="mt-3 text-xs text-text-muted">
            Ramps <span className="text-text">{num(first, 2)}%</span> →{' '}
            <span className="text-text">{num(last, 2)}%</span> per month
          </p>
        )}

        <div className="mt-auto pt-6">
          <div className="hairline" />
          <p className="mt-3 flex items-center gap-1.5 text-xs text-text-dim">
            <ShieldCheck size={12} />
            {plan.return_principal_at_maturity
              ? 'Principal returned at maturity'
              : 'Principal held past maturity'}
          </p>
        </div>
      </div>
    </Tilt>
  );
}

function EmptyNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-12 rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-text-muted">
      {children}
    </p>
  );
}
