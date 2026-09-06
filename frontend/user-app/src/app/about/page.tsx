import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, BadgeCheck, Banknote, Building2, HandCoins, Lock, Network, ShieldCheck,
} from 'lucide-react';

import PageBackdrop from '@/components/PageBackdrop';
import Reveal from '@/components/Reveal';
import LandingMotion from '@/components/LandingMotion';
import WaveDivider from '@/components/WaveDivider';

export const metadata: Metadata = {
  title: 'About — NorthGold',
  description:
    'How NorthGold works: partner-bank instruments, contracted monthly returns, cash deposits verified by a human, and commission that runs through your whole network.',
};

const PILLARS = [
  {
    icon: Building2,
    title: 'Partner-bank instruments',
    body: 'Every plan is backed by a fixed-income product from a listed partner institution. Nothing on the board is synthetic and nothing is leveraged.',
  },
  {
    icon: BadgeCheck,
    title: 'Terms frozen at purchase',
    body: 'The month-by-month schedule you read before you invest is copied onto your investment and never changes, even if the plan is edited afterwards.',
  },
  {
    icon: HandCoins,
    title: 'Cash, verified by a person',
    body: 'Deposits and withdrawals are handed over in person. You describe the handover, an administrator checks it against the receipt, and only then does the balance move.',
  },
  {
    icon: Network,
    title: 'Commission across the network',
    body: 'You earn on the people you introduce and on the people they introduce, level by level, with every payment recorded against the deposit that triggered it.',
  },
];

const VALUES = [
  { icon: Lock, title: 'No hidden mechanics', body: 'Rates, tiers and commission levels are published on the site, not buried in a contract.' },
  { icon: ShieldCheck, title: 'One ledger', body: 'Every rupee that moves writes an append-only transaction row. Balances are never edited in place.' },
  { icon: Banknote, title: 'Paid monthly', body: 'Returns are credited on a schedule you can read in full on day one, not at maturity.' },
];

export default function AboutPage() {
  return (
    <>
      <LandingMotion />
      <PageBackdrop />

      <section className="relative isolate overflow-hidden bg-bg">
        <div className="relative mx-auto max-w-4xl px-4 pb-20 pt-20 text-center sm:px-6 lg:pb-24 lg:pt-28">
          <Reveal>
            <p className="eyebrow">About NorthGold</p>
            <h1 className="mt-4 text-balance text-display font-semibold text-text text-3d">
              A brighter tomorrow, <span className="text-gradient-gold">built one month at a time</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-muted">
              NorthGold exists for people who want their savings to do something
              visible every month — not in ten years, and not on a chart they have
              to squint at. You deposit once, you can read the entire return
              schedule before you commit, and the money arrives on time.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="relative isolate border-y border-border py-20 lg:py-28">
        <WaveDivider position="top" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <p className="eyebrow">What we actually do</p>
              <h2 className="mt-3 text-display-sm font-semibold tracking-tight text-3d">
                Four things, done properly
              </h2>
              <span className="mx-auto mt-4 block h-px w-24 bg-gradient-to-r from-accent to-transparent" data-anim="rule" aria-hidden />
            </div>
          </Reveal>

          <div className="mt-14 grid gap-5 sm:grid-cols-2" data-anim="stagger">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="card card-hover p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent shadow-e1">
                  <Icon size={19} />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-text">{title}</h3>
                <p className="mt-2 leading-relaxed text-text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
        <WaveDivider position="bottom" />
      </section>

      <section className="bg-bg py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <div className="mx-auto max-w-3xl text-center">
              <p className="eyebrow">How we operate</p>
              <h2 className="mt-3 text-display-sm font-semibold tracking-tight text-3d">
                The rules we hold ourselves to
              </h2>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-5 sm:grid-cols-3" data-anim="stagger">
            {VALUES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="card p-6 text-center">
                <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-border bg-white/[0.04] text-accent">
                  <Icon size={18} />
                </span>
                <h3 className="mt-4 font-semibold text-text">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{body}</p>
              </div>
            ))}
          </div>

          <Reveal>
            <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
              <Link href="/register" className="btn-primary px-7 py-3.5 text-base">
                Open an account <ArrowRight size={17} />
              </Link>
              <Link href="/contact" className="btn-ghost px-7 py-3.5 text-base">
                Talk to us
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
