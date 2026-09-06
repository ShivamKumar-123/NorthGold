import { ShieldCheck } from 'lucide-react';

import Reveal from '@/components/Reveal';
import SplitWords from '@/components/SplitWords';
import Tilt from '@/components/Tilt';
import { money, num } from '@/lib/format';
import { totalReturnPercent, type RoiPlan } from '@/lib/types';

/* ── Shape adapter ─────────────────────────────────────────────────────────
   The only difference between this file and its twin in the Next build. The
   demo stores a plan's months as plain percentages; the API serialises them
   as `{ percent }` rows and carries the total as its own field. Everything
   below this block is identical in both, so the two stay in step. */
const monthsOf = (plan: RoiPlan): number[] => plan.months;
const totalOf = (plan: RoiPlan): number => totalReturnPercent(plan);
/* ─────────────────────────────────────────────────────────────────────── */

/**
 * The four tiers and their rate ramps.
 *
 * Lives on the calculator page rather than the landing page. It used to be a
 * band in the middle of the marketing scroll; it belongs next to the tool
 * that computes against it, and these are contracted rates — they have to
 * stay published somewhere a prospect can find them, not simply disappear
 * when the section they were in goes away.
 *
 * Keeps the `plans` anchor so every link that pointed at the old section
 * still lands on the tiers.
 */
export default function PlanTiers({ plans }: { plans: RoiPlan[] }) {
  return (
    <section id="plans" className="relative isolate scroll-mt-24 border-y border-border bg-bg">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(217,166,46,.12),transparent_70%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center" data-anim="head">
            <p className="eyebrow" data-head="eyebrow">
              Return schedule
            </p>
            <h2 className="mt-3 text-display-sm font-semibold tracking-tight text-3d" data-head="title">
              <SplitWords text="Bigger deposit, higher tier. Longer hold, higher rate." />
            </h2>
            <span
              className="mx-auto mt-4 block h-px w-24 bg-gradient-to-r from-accent to-transparent"
              data-head="rule"
              aria-hidden
            />
            <p className="mt-4 leading-relaxed text-text-muted" data-head="copy">
              Every plan pays a different percentage in each month of its term.
              Your amount picks the tier; time moves you along the curve.
            </p>
          </div>
        </Reveal>

        {plans.length === 0 ? (
          <p className="mt-12 rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-text-muted">
            No plans are published yet.
          </p>
        ) : (
          <div className="perspective-lg mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4" data-anim="stagger">
            {plans.map((plan, i) => (
              <Reveal key={plan.id} delay={i * 90} className="h-full">
                <PlanCard plan={plan} featured={i === plans.length - 1} />
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
  );
}

function PlanCard({ plan, featured }: { plan: RoiPlan; featured?: boolean }) {
  const months = monthsOf(plan);
  const first = months[0];
  const last = months[months.length - 1];
  const peak = Math.max(...months, 0);

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
            {num(totalOf(plan), 2)}%
          </span>
          <p className="mt-1 text-xs text-text-dim">total over {plan.tenure_months} months</p>
        </div>

        {/* Month curve — a tiny bar chart says "the rate ramps" faster than a
            sentence does. */}
        <div className="mt-6 flex h-14 items-end gap-[3px] layer-1" aria-hidden>
          {months.map((percent, i) => {
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

        {first !== undefined && last !== undefined && (
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
