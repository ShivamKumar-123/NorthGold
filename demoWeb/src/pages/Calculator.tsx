import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CalendarClock, Layers, Wallet } from 'lucide-react';

import LandingMotion from '@/components/LandingMotion';
import PageBackdrop from '@/components/PageBackdrop';
import PlanTiers from '@/components/PlanTiers';
import Reveal from '@/components/Reveal';
import ReturnsCalculator from '@/components/ReturnsCalculator';
import WaveDivider from '@/components/WaveDivider';
import { getPlans } from '@/lib/store';

const NOTES = [
  {
    icon: Layers,
    title: 'Your amount picks the tier',
    body: 'Each tier covers a deposit range. Put in more and you move up a tier, which changes the whole schedule — not just the last month.',
  },
  {
    icon: CalendarClock,
    title: 'The rate climbs with time',
    body: 'Every plan pays a different percentage in each month of its term, starting low and ramping up. Holding to maturity is what earns the headline figure.',
  },
  {
    icon: BadgeCheck,
    title: 'Frozen at purchase',
    body: 'The schedule you read here is copied onto your investment the day you buy it. Editing the plan afterwards never touches an investment already running.',
  },
  {
    icon: Wallet,
    title: 'Principal comes back',
    body: 'The monthly payouts are return, not repayment. Your original deposit returns to your wallet when the term matures.',
  },
];

/**
 * The returns calculator, on its own page.
 *
 * It used to be a band on the landing page, which put a tool people come back
 * to behind a scroll through the whole pitch. On its own route it can be
 * linked to directly, and it has room for the notes that explain what the
 * numbers mean — which never fitted in a section that had to keep moving.
 */
export default function CalculatorPage() {
  const plans = getPlans();

  return (
    <>
      <LandingMotion />
      <PageBackdrop />

      <section className="relative isolate overflow-hidden bg-bg">
        <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-20 text-center sm:px-6 lg:pb-20 lg:pt-28">
          <Reveal>
            <p className="eyebrow">Returns calculator</p>
            <h1 className="mt-4 text-balance text-display font-semibold text-text text-3d">
              See every payout, <span className="text-gradient-gold">month by month</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-muted">
              Enter an amount and read the whole term before you commit — every
              month, its rate, its payout and the running total. This is the same
              schedule the platform will pay you, computed by the same code, not
              an estimate.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-bg pb-20 lg:pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <ReturnsCalculator plans={plans} />
          </Reveal>
        </div>
      </section>

      {/* The tiers, moved off the landing page. They belong beside the tool
          that computes against them, and these are contracted rates — they
          have to stay published somewhere a prospect can find them. */}
      <PlanTiers plans={plans} />

      <section className="relative isolate border-y border-border py-20 lg:py-28">
        <WaveDivider position="top" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <p className="eyebrow">Reading the schedule</p>
              <h2 className="mt-3 text-display-sm font-semibold tracking-tight text-3d">
                What the numbers actually mean
              </h2>
              <span
                className="mx-auto mt-4 block h-px w-24 bg-gradient-to-r from-accent to-transparent"
                aria-hidden
              />
            </div>
          </Reveal>

          <div className="mt-14 grid gap-5 sm:grid-cols-2" data-anim="stagger">
            {NOTES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="card card-hover p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent shadow-e1">
                  <Icon size={19} />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-text">{title}</h3>
                <p className="mt-2 leading-relaxed text-text-muted">{body}</p>
              </div>
            ))}
          </div>

          <Reveal>
            <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
              <Link to="/register" className="btn-primary px-7 py-3.5 text-base">
                Open an account <ArrowRight size={17} />
              </Link>
              <Link to="/about" className="btn-ghost px-7 py-3.5 text-base">
                How it works
              </Link>
            </div>
          </Reveal>
        </div>
        <WaveDivider position="bottom" />
      </section>
    </>
  );
}
