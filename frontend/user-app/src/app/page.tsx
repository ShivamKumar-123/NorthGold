import Link from 'next/link';
import { ArrowRight, Banknote, Lock, ShieldCheck, Sparkles } from 'lucide-react';

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
import { API_BASE, money } from '@/lib/api';
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
              {/* The greeting leads. It is the masthead, so it sits above the
                  chip rather than wedged between it and the headline — and it
                  is set large enough to read as one. Folding it into the h1
                  would put a salutation inside the sentence the page is
                  actually there to make.

                  The tracking here has to match the value the load timeline
                  animates it to, or GSAP's inline style wins and the class is
                  ignored. */}
              <p
                className="text-base font-semibold uppercase tracking-[0.18em] text-gradient-gold
                           sm:text-lg lg:text-xl"
                data-anim="hero-welcome"
              >
                Welcome to Net financing
              </p>

              <span className="chip mx-auto mt-5 lg:mx-0" data-anim="hero-chip">
                <Sparkles size={12} className="text-gold" />
                Verified partner-bank instruments
                <span className="mx-1 h-3 w-px bg-white/15" />
                <span className="text-success">Monthly payouts</span>
              </span>

              {/* Solid body, gradient only on the phrase that matters.
                  Running .text-gradient across every span gives each its own
                  ramp, which turns the opening words muddy. */}
              <h1
                className="mt-5 text-balance text-display font-semibold text-text text-3d [overflow-wrap:break-word]"
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

      {/* ══ Global presence ══════════════════════════════════════ */}
      <GlobalPresence />

      {/* ══ Live foreign exchange ════════════════════════════════ */}
      <ForexRates />
      <ForexCrossRates />

      {/* ══ CTA ════════════════════════════════════════════════ */}
      <section className="relative isolate overflow-hidden">
        <WaveDivider position="top" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <Reveal>
            {/* `on-dark` because the panel is painted over a dark photograph in
                both site themes — without it the copy would flip to near-black
                on black the moment someone switches to light. */}
            <div className="on-dark grain relative isolate overflow-hidden rounded-3xl border border-white/[0.08] shadow-e4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/bg/account.webp"
                alt=""
                width={2048}
                height={768}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 -z-20 h-full w-full object-cover"
                aria-hidden
              />
              {/* Weighted to the left, where the words are: the right half of
                  the photograph is the part worth seeing. */}
              <div
                className="absolute inset-0 -z-10"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(4,5,8,.94) 0%, rgba(4,5,8,.86) 38%, rgba(4,5,8,.45) 72%, rgba(4,5,8,.25) 100%)',
                }}
                aria-hidden
              />

              <div className="relative flex flex-col gap-8 px-6 py-14 sm:px-12 lg:flex-row lg:items-center lg:justify-between lg:py-16">
                <div>
                  <h2 className="text-display-sm font-semibold text-text text-3d">
                    Instant account opening &amp; funding
                  </h2>
                  <p className="mt-3 text-lg font-medium text-gradient-gold">Trade within minutes!</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link href="/register" className="btn-primary px-7 py-3.5 text-base">
                    Open An Account
                    <ArrowRight size={17} />
                  </Link>
                </div>
              </div>

              <p className="relative px-6 pb-10 text-xs leading-relaxed text-text-dim sm:px-12">
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


