import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';

import ContactForm from '@/components/ContactForm';
import PageBackdrop from '@/components/PageBackdrop';
import Reveal from '@/components/Reveal';
import LandingMotion from '@/components/LandingMotion';
import { getSettings } from '@/lib/store';

export default function ContactPage() {
  const s = getSettings();
  const wa = (s.support_whatsapp || '').replace(/\D/g, '');

  const CHANNELS = [
    {
      icon: MessageCircle,
      label: 'WhatsApp',
      value: s.support_phone || '—',
      hint: 'Fastest route — usually answered within the hour',
      href: wa ? `https://wa.me/${wa}` : undefined,
      primary: true,
    },
    {
      icon: Phone,
      label: 'Phone',
      value: s.support_phone || '—',
      hint: s.support_hours || 'Mon–Sat',
      href: s.support_phone ? `tel:${s.support_phone.replace(/\s/g, '')}` : undefined,
    },
    {
      icon: Mail,
      label: 'Email',
      value: s.support_email || '—',
      hint: 'For anything that needs a paper trail',
      href: s.support_email ? `mailto:${s.support_email}` : undefined,
    },
  ];

  return (
    <>
      <LandingMotion />
      <PageBackdrop />

      <section className="bg-bg">
        <div className="mx-auto max-w-4xl px-4 pb-16 pt-20 text-center sm:px-6 lg:pt-28">
          <Reveal>
            <p className="eyebrow">Contact</p>
            <h1 className="mt-4 text-balance text-display font-semibold text-text text-3d">
              Talk to a <span className="text-gradient-gold">real person</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-text-muted">
              Deposits and withdrawals are handled in person here, so the desk is
              staffed by people who can actually answer you — not a ticket queue.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-5 sm:grid-cols-3" data-anim="stagger">
            {CHANNELS.map(({ icon: Icon, label, value, hint, href, primary }) => {
              const body = (
                <>
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-xl border shadow-e1 ${
                      primary
                        ? 'border-success/40 bg-success/15 text-success'
                        : 'border-accent/30 bg-accent/10 text-accent'
                    }`}
                  >
                    <Icon size={19} />
                  </span>
                  <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-text-dim">{label}</p>
                  <p className="mt-1 break-words text-lg font-semibold text-text">{value}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-text-muted">{hint}</p>
                </>
              );

              return href ? (
                <a
                  key={label}
                  href={href}
                  target={primary ? '_blank' : undefined}
                  rel={primary ? 'noreferrer' : undefined}
                  className="card card-hover block p-6"
                >
                  {body}
                </a>
              ) : (
                <div key={label} className="card p-6">{body}</div>
              );
            })}
          </div>

          <Reveal>
            <div className="panel mt-6 grid gap-6 p-7 sm:grid-cols-2">
              <div>
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-text-dim">
                  <MapPin size={13} /> Counter
                </p>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-text">{s.support_address || '—'}</p>
              </div>
              <div>
                <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-text-dim">
                  <Clock size={13} /> Hours
                </p>
                <p className="mt-2 leading-relaxed text-text">{s.support_hours || '—'}</p>
                <p className="mt-3 text-xs leading-relaxed text-text-muted">
                  Bring a photo ID for any cash handover. You will be given a
                  receipt number to quote in your deposit request.
                </p>
              </div>
            </div>
          </Reveal>

        </div>
      </section>

      <ContactForm whatsapp={wa} email={s.support_email || ''} />

      <section className="bg-bg pb-24 pt-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/register" className="btn-primary px-7 py-3.5 text-base">
                Open an account <ArrowRight size={17} />
              </Link>
              <Link to="/about" className="btn-ghost px-7 py-3.5 text-base">
                How it works
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
