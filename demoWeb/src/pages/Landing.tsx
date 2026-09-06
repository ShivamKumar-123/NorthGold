import {
  ArrowRight, ArrowUpRight, BadgeCheck, Banknote, Building2, Layers,
  Lock, ShieldCheck, Sparkles, TrendingUp, Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import CardPromo from '@/components/CardPromo';
import Counter from '@/components/Counter';
import HeroScene from '@/components/HeroScene';
import LandingMotion from '@/components/LandingMotion';
import MarqueeTicker from '@/components/MarqueeTicker';
import NetworkDiagram from '@/components/NetworkDiagram';
import PageBackdrop from '@/components/PageBackdrop';
import ReturnsCalculator from '@/components/ReturnsCalculator';
import Reveal from '@/components/Reveal';
import SectionBackdrop from '@/components/SectionBackdrop';
import SplitWords from '@/components/SplitWords';
import Tilt from '@/components/Tilt';
import WaveDivider from '@/components/WaveDivider';
import { money, num } from '@/lib/format';
import { getInstruments, getIssuers, getLevels, getPlans } from '@/lib/store';
import { totalReturnPercent, type RoiPlan } from '@/lib/types';

export default function LandingPage() {
  // Read straight from the store. In the Django build these were four network
  // calls that had to degrade gracefully; here the data is already in memory,
  // so there is nothing to fail and nothing to wait for.
  const instruments = getInstruments();
  const planList = getPlans();
  const levels = getLevels();
  const issuerList = getIssuers();

  const topYield = planList.length ? Math.max(...planList.map(totalReturnPercent)) : 0;
  const entryPoint = planList.length ? Math.min(...planList.map((p) => p.min_amount)) : 0;
  const topMonthlyRate = planList.reduce(
    (best, plan) => Math.max(best, Math.max(...plan.months)),
    0,
  );
  // Tenure is per-plan and admin-editable, so the yield label cannot hardcode 12.
  const tenures = new Set(planList.map((p) => p.tenure_months));
  const yieldLabel = tenures.size === 1 ? `Best ${[...tenures][0]}-month yield` : 'Best total yield';
  // The top tier drives the hero card — it is the most compelling schedule.
  const headlinePlan =
    [...planList].sort((a, b) => totalReturnPercent(b) - totalReturnPercent(a))[0] ?? null;

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

        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 lg:pb-32 lg:pt-24">
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

              {/* Solid body, gradient only on the phrase that matters.
                  Running .text-gradient across every span gives each its own
                  ramp, which turns the opening words muddy. */}
              <h1
                className="mt-7 text-balance text-display font-semibold text-text text-3d [overflow-wrap:break-word]"
                data-anim="hero-title"
              >
                <SplitWords text="Your money should pay you" />{' '}
                <SplitWords text="every month" className="text-gradient-gold" />
              </h1>

              <p
                className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-text-muted lg:mx-0"
                data-anim="hero-copy"
              >
                Deposit once into a partner-bank instrument and receive a
                contracted return every month — on a schedule you can read in
                full before you commit. Hold longer, earn more.
              </p>

              <div
                className="mt-10 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
                data-anim="hero-cta"
              >
                <Link to="/register" className="btn-primary px-7 py-3.5 text-base">
                  Open an account
                  <ArrowRight size={17} />
                </Link>
                <Link to="#calculator" className="btn-ghost px-7 py-3.5 text-base">
                  See your returns
                </Link>
              </div>

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

            {/* ── 3D card stack ────────────────────────────────────── */}
            <div className="relative perspective-lg" data-anim="hero-scene">
              <HeroScene plan={headlinePlan} />
            </div>
          </div>

          {/* Headline figures */}
          <Reveal delay={400}>
            <dl
              className="perspective mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-4 lg:grid-cols-4"
              data-anim="stagger"
            >
              <HeroStat
                value={<Counter value={topMonthlyRate} decimals={2} suffix="%" />}
                label="Top monthly rate"
                tone="text-gradient-gold"
                glow="rgba(217,166,46,.4)"
              />
              <HeroStat
                value={<Counter value={topYield} decimals={1} suffix="%" />}
                label={yieldLabel}
                glow="rgba(217,166,46,.4)"
              />
              <HeroStat
                value={<Counter value={instruments.length} />}
                label="Listed instruments"
                glow="rgba(232,232,229,.35)"
              />
              <HeroStat
                value={<Counter value={levels.length} />}
                label="Commission levels"
                glow="rgba(184,115,51,.4)"
              />
            </dl>
          </Reveal>
        </div>

        <MarqueeTicker instruments={instruments} />
      </section>

      {/* ══ Issuers ════════════════════════════════════════════════════════ */}
      {issuerList.length > 0 && (
        <section className="border-b border-border bg-bg">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <Reveal className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-text-dim">
                Instruments issued by
              </span>
              {issuerList.map((issuer) => (
                <span
                  key={issuer.id}
                  className="flex items-center gap-2 text-sm font-medium text-text-muted transition hover:text-text"
                >
                  <Building2 size={15} className="text-text-faint" />
                  {issuer.name}
                </span>
              ))}
            </Reveal>
          </div>
        </section>
      )}

      {/* ══ Card promo ═════════════════════════════════════════════════════ */}
      <CardPromo />

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

      {/* ══ Calculator ═════════════════════════════════════════════════════ */}
      <section id="calculator" className="border-b border-border bg-bg">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <Reveal>
            <SectionHead
              eyebrow="Before you commit"
              title="See every payout, month by month"
              description="This is the same schedule the platform will pay you — computed by the same code, not an estimate."
              center
            />
          </Reveal>
          <Reveal delay={120} className="mt-12">
            <ReturnsCalculator plans={planList} />
          </Reveal>
        </div>
      </section>

      {/* ══ Referral ═══════════════════════════════════════════════════════ */}
      <section id="referral" className="relative isolate overflow-hidden border-b border-border">
        <WaveDivider position="top" />
        <WaveDivider position="bottom" />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-96 bg-[radial-gradient(60%_100%_at_50%_100%,rgba(184,115,51,.12),transparent_70%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <Reveal>
            <SectionHead
              eyebrow="Refer & earn"
              title="Earn from your referrals — and from theirs"
              description="Level 1 is someone you personally introduced. Levels 2 and beyond are their introductions, and so on down your network. You earn once when they deposit, then again every month they get paid."
              center
            />
          </Reveal>

          {levels.length === 0 ? (
            <EmptyNotice>The referral programme is not published yet.</EmptyNotice>
          ) : (
            <>
              <Reveal delay={120} className="mt-14">
                <NetworkDiagram levels={levels} />
              </Reveal>

              <Reveal delay={200} className="mt-14">
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Level</th>
                        <th>Relationship</th>
                        <th className="text-right">On their deposit</th>
                        <th className="text-right">On their monthly return</th>
                        <th className="text-right">Unlocks at</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levels.map((level) => (
                        <tr key={level.level}>
                          <td className="font-semibold">Level {level.level}</td>
                          <td>
                            <span
                              className={`badge ${
                                level.level === 1
                                  ? 'bg-accent/15 text-accent'
                                  : 'bg-bronze/15 text-bronze'
                              }`}
                            >
                              {level.level === 1 ? 'direct' : 'indirect'}
                            </span>
                          </td>
                          <td className="text-right tabular-nums text-success">
                            {num(level.deposit_percent, 2)}%
                          </td>
                          <td className="text-right tabular-nums text-success">
                            {num(level.roi_percent, 2)}%
                          </td>
                          <td className="text-right text-text-muted">
                            {level.min_directs > 0
                              ? `${level.min_directs} direct referrals`
                              : 'Immediately'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Reveal>

              <div className="perspective mt-6 grid gap-5 sm:grid-cols-3" data-anim="stagger">
                {[
                  {
                    icon: <Users size={18} />,
                    title: 'Direct referrals',
                    body: 'Anyone who signs up on your link sits at level 1 and pays you the level-1 rate on everything they do.',
                    tone: 'accent' as const,
                  },
                  {
                    icon: <Layers size={18} />,
                    title: 'Indirect referrals',
                    body: 'When your referrals bring their own people, those sit at level 2, 3 and deeper — and still pay you.',
                    tone: 'bronze' as const,
                  },
                  {
                    icon: <TrendingUp size={18} />,
                    title: 'Recurring, not one-off',
                    body: 'You earn once when they deposit, then again every single month they receive their return.',
                    tone: 'gold' as const,
                  },
                ].map((feature, i) => (
                  <Reveal key={feature.title} delay={i * 90} className="h-full">
                    <FeatureCard {...feature} />
                  </Reveal>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

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

      {/* ══ CTA ════════════════════════════════════════════════════════════ */}
      <section className="relative isolate overflow-hidden">
        <WaveDivider position="top" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <Reveal>
            <div className="grain relative isolate overflow-hidden rounded-3xl border border-white/[0.08] px-6 py-16 text-center shadow-e4 sm:px-12">
              {/* This render ships with its own studio backdrop, so it works as
                  a bleed rather than a cut-out. The gradient over it keeps the
                  copy at full contrast. */}
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
                <Link to="/register" className="btn-primary px-7 py-3.5 text-base">
                  Open an account
                  <ArrowRight size={17} />
                </Link>
                <Link to="#instruments" className="btn-ghost px-7 py-3.5 text-base">
                  Browse instruments
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

function HeroStat({
  value,
  label,
  tone = 'text-text',
  glow,
}: {
  value: React.ReactNode;
  label: string;
  tone?: string;
  glow: string;
}) {
  return (
    <Tilt max={9} lift={12}>
      <div className="card preserve-3d group overflow-hidden px-5 py-6 text-center transition-shadow duration-300 hover:shadow-e3">
        <span
          className="pointer-events-none absolute inset-x-0 -top-16 mx-auto h-32 w-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: glow }}
          aria-hidden
        />
        <dd className={`relative text-3xl font-semibold tracking-tight layer-1 ${tone}`}>{value}</dd>
        <dt className="relative mt-2 text-[11px] uppercase tracking-[0.12em] text-text-dim">
          {label}
        </dt>
      </div>
    </Tilt>
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
  // Months are plain percentages in the store, not {month_index, percent}
  // rows — there is no serializer in between to give them a shape.
  const first = plan.months[0];
  const last = plan.months[plan.months.length - 1];
  const peak = Math.max(...plan.months, 0);

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
            {num(totalReturnPercent(plan), 2)}%
          </span>
          <p className="mt-1 text-xs text-text-dim">total over {plan.tenure_months} months</p>
        </div>

        {/* Month curve — a tiny bar chart says "the rate ramps" faster than a
            sentence does. */}
        <div className="mt-6 flex h-14 items-end gap-[3px] layer-1" aria-hidden>
          {plan.months.map((percent, i) => {
            const height = peak > 0 ? (percent / peak) * 100 : 0;
            return (
              <span
                key={i}
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
            Principal returned at maturity
          </p>
        </div>
      </div>
    </Tilt>
  );
}

const FEATURE_TONES = {
  accent: 'border-accent/25 bg-accent/10 text-accent',
  bronze: 'border-bronze/25 bg-bronze/10 text-bronze',
  gold: 'border-gold/25 bg-gold/10 text-gold',
} as const;

function FeatureCard({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: keyof typeof FEATURE_TONES;
}) {
  return (
    <Tilt max={6} lift={12} className="h-full">
      <div className="card preserve-3d h-full p-6 transition-shadow duration-300 hover:shadow-e3">
        <div className={`inline-flex rounded-xl border p-2.5 shadow-e1 layer-2 ${FEATURE_TONES[tone]}`}>
          {icon}
        </div>
        <h3 className="mt-4 font-semibold layer-1">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-text-muted">{body}</p>
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
