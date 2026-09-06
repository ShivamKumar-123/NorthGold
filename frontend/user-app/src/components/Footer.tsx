import Link from 'next/link';
import {
  AlertTriangle, ArrowRight, ArrowUpRight, Instagram, Linkedin, Twitter, Youtube,
} from 'lucide-react';

import Logo from '@/components/Logo';

const COLUMNS = [
  {
    title: 'Platform',
    links: [
      { href: '/about', label: 'How it works' },
      { href: '/#plans', label: 'Return plans' },
      { href: '/calculator', label: 'Returns calculator' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/register', label: 'Open an account' },
      { href: '/login', label: 'Sign in' },
      { href: '/wallet', label: 'Deposit & withdraw' },
      { href: '/profile', label: 'Profile & KYC' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About us' },
      { href: '/contact', label: 'Contact us' },
      { href: '/about', label: 'Security' },
      { href: '/contact', label: 'Help center' },
    ],
  },
];

const SOCIALS = [
  { href: '#', label: 'LinkedIn', Icon: Linkedin },
  { href: '#', label: 'Twitter', Icon: Twitter },
  { href: '#', label: 'Instagram', Icon: Instagram },
  { href: '#', label: 'YouTube', Icon: Youtube },
];

export default function Footer() {
  return (
    <footer className="relative isolate mt-auto overflow-hidden border-t border-border">
      {/* Mountain plate. The gradient runs left-to-right so the half carrying
          the copy stays darkest while the peaks on the right stay visible. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/bg/footer.webp"
        alt=""
        width={1920}
        height={768}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 -z-20 h-[124%] w-full object-cover opacity-70"
        data-parallax="0.1"
      />
      <div className="scrim-footer absolute inset-0 -z-10" aria-hidden />

      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-14 sm:px-6">
        {/* ── Closing CTA ────────────────────────────────────────────── */}
        <div className="plate-cta rounded-3xl border border-white/[0.09] p-7 shadow-e3 backdrop-blur-sm sm:p-9" data-anim="foot-cta">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="eyebrow">Invest a brighter tomorrow</p>
              <h2 className="mt-3 text-display-sm font-semibold text-text text-3d">
                Ready to make your money{' '}
                <span className="text-gradient-gold">work harder?</span>
              </h2>
              <p className="mt-3 leading-relaxed text-text-muted">
                Join a network that trusts NorthGold for secure, transparent and
                consistent returns.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href="/register" className="btn-primary px-6 py-3.5">
                Open an account <ArrowRight size={16} />
              </Link>
              <Link href="/#plans" className="btn-ghost px-6 py-3.5">
                Explore plans <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Columns ────────────────────────────────────────────────── */}
        <div className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)_0.9fr]" data-anim="foot-cols">
          <div>
            <Logo className="h-11" />
            <p className="mt-2 text-[10px] uppercase tracking-[0.24em] text-text-dim">
              Your trust. A brighter tomorrow
            </p>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-text-muted">
              Fixed-income instruments from partner banks, with transparent
              monthly returns and a referral programme that pays across your
              whole network.
            </p>

            <div className="mt-6 flex gap-2.5" data-anim="foot-social">
              {SOCIALS.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="grid h-10 w-10 place-items-center rounded-full border border-border
                             bg-white/[0.03] text-text-muted transition-all duration-200
                             hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent hover:shadow-e2"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                {column.title}
              </h3>
              <ul className="mt-5 space-y-3 text-sm">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1.5 text-text-muted transition hover:text-text"
                    >
                      {link.label}
                      <ArrowRight
                        size={12}
                        className="opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="lg:border-l lg:border-border lg:pl-8">
            <p className="text-[11px] uppercase leading-loose tracking-[0.22em] text-text-muted">
              Building
              <br />a brighter
              <br />tomorrow
            </p>
            <span className="mt-4 block h-px w-12 bg-gradient-to-r from-accent to-transparent" data-anim="foot-rule" />
          </div>
        </div>

        {/* ── Risk notice ────────────────────────────────────────────── */}
        <div className="mt-12 flex flex-col gap-5 rounded-2xl border border-warn/25 bg-[rgba(249,115,22,.07)] p-5 backdrop-blur-sm lg:flex-row lg:items-center lg:gap-6" data-anim="foot-risk">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-warn/30 bg-warn-soft text-warn">
            <AlertTriangle size={18} />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-warn">Risk notice</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">
              Returns shown are the contracted schedule for each plan and are not
              a guarantee of future performance. Capital is at risk. Read the plan
              terms in full before investing, and never invest money you cannot
              afford to lose.
            </p>
          </div>
          <Link href="/#plans" className="btn-ghost shrink-0 px-5 py-3 text-xs text-warn">
            Read full disclosure <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      {/* ── Bottom bar ───────────────────────────────────────────────── */}
      <div className="plate-footer-bar relative border-t border-border/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-text-dim sm:flex-row sm:px-6">
          <p>&copy; {new Date().getFullYear()} NorthGold. All rights reserved.</p>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {['Privacy Policy', 'Terms of Service', 'Risk Disclosure', 'Cookies'].map((item) => (
              <Link key={item} href="/#plans" className="transition hover:text-text-muted">
                {item}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
