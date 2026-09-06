import { useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Mail, MessageCircle } from 'lucide-react';

const TOPICS = [
  'Opening an account',
  'Making a deposit',
  'A withdrawal',
  'Referral commission',
  'Something else',
];

/**
 * The contact form.
 *
 * It composes rather than posts. There is no enquiry inbox behind this page —
 * the desk runs on WhatsApp, which the panel above already leads with — and a
 * form that POSTs into nothing would look like it worked while quietly
 * dropping every message. So the fields are assembled into a readable message
 * and handed to WhatsApp (or the mail client), where a person actually reads
 * it. The button says exactly where it goes.
 *
 * If a stored inbox is wanted later, this is the one place that changes: swap
 * the handoff for a POST and add the model behind it.
 */
export default function ContactForm({
  whatsapp,
  email,
}: {
  /** Digits only, country code included. Empty hides the WhatsApp route. */
  whatsapp: string;
  email: string;
}) {
  const [form, setForm] = useState({ name: '', contact: '', topic: TOPICS[0], message: '' });
  const [error, setError] = useState('');

  // Same rule as CardPromo: the entrance is armed on the client, never baked
  // into the server HTML, so an `initial={{ opacity: 0 }}` can never be what
  // ships when the animation does not run.
  const [armed, setArmed] = useState(false);
  useLayoutEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setArmed(true);
  }, []);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function compose() {
    return [
      `Hello NorthGold — ${form.topic}.`,
      '',
      form.message.trim(),
      '',
      `— ${form.name.trim() || 'A visitor'}${form.contact.trim() ? ` (${form.contact.trim()})` : ''}`,
    ].join('\n');
  }

  function handoff(via: 'whatsapp' | 'email') {
    if (!form.message.trim()) {
      setError('Add a short message so the desk knows what you need.');
      return;
    }
    setError('');
    const body = compose();

    if (via === 'whatsapp' && whatsapp) {
      window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(body)}`, '_blank', 'noopener');
      return;
    }
    window.location.href =
      `mailto:${email}?subject=${encodeURIComponent(`NorthGold — ${form.topic}`)}` +
      `&body=${encodeURIComponent(body)}`;
  }

  return (
    <section className="relative isolate overflow-hidden border-t border-border bg-bg">
      {/* Warm pool behind the figure so she is lit by the page, not pasted on. */}
      <div
        className="pointer-events-none absolute right-0 top-1/2 h-[680px] w-[680px] -translate-y-1/2 translate-x-1/3 rounded-full opacity-50 blur-[130px]"
        style={{ background: 'radial-gradient(circle, rgba(217,166,46,.26), transparent 70%)' }}
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        {/* ── Form ─────────────────────────────────────────────────── */}
        <div className="w-full max-w-xl">
          <p className="eyebrow">Send a message</p>
          <h2 className="mt-3 text-display-sm font-semibold tracking-tight text-3d">
            Tell us what you <span className="text-gradient-gold">need</span>
          </h2>
          <p className="mt-4 leading-relaxed text-text-muted">
            Fill this in and it opens the thread on WhatsApp with your message
            ready to send — so it lands with a person, not in a queue.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handoff('whatsapp');
            }}
            className="mt-8 space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="c-name">Your name</label>
                <input
                  id="c-name"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  className="input"
                  placeholder="Priya Sharma"
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="label" htmlFor="c-contact">Phone or email</label>
                <input
                  id="c-contact"
                  value={form.contact}
                  onChange={(e) => set('contact', e.target.value)}
                  className="input"
                  placeholder="+91 98765 43210"
                  autoComplete="tel"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="c-topic">What is it about?</label>
              <select
                id="c-topic"
                value={form.topic}
                onChange={(e) => set('topic', e.target.value)}
                className="input"
              >
                {TOPICS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="c-message">
                Message <span className="text-danger">*</span>
              </label>
              <textarea
                id="c-message"
                rows={4}
                value={form.message}
                onChange={(e) => set('message', e.target.value)}
                className="input resize-none"
                placeholder="I would like to deposit ₹50,000 in cash this week — which counter should I come to?"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex flex-wrap gap-3 pt-1">
              {whatsapp && (
                <button type="submit" className="btn-primary px-6 py-3.5">
                  <MessageCircle size={16} /> Send on WhatsApp <ArrowRight size={15} />
                </button>
              )}
              <button type="button" onClick={() => handoff('email')} className="btn-ghost px-6 py-3.5">
                <Mail size={16} /> Send by email
              </button>
            </div>

            <p className="pt-1 text-xs leading-relaxed text-text-dim">
              Nothing is stored on this page — the message goes straight to the
              desk in whichever app you pick.
            </p>
          </form>
        </div>

        {/* ── Figure ───────────────────────────────────────────────────
            She points to the viewer's left, so she sits on the RIGHT and her
            gesture lands back on the form. */}
        <motion.div
          {...(armed
            ? {
                initial: { opacity: 0, x: 40 },
                whileInView: { opacity: 1, x: 0 },
                viewport: { once: true, amount: 0.25 },
                transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] as const },
              }
            : {})}
          className="relative mx-auto hidden w-full max-w-[460px] lg:block lg:max-w-none"
        >
              <img
            src="/images/people/contact.webp"
            alt=""
            width={900}
            height={881}
            loading="lazy"
            decoding="async"
            className="relative z-10 mx-auto w-full drop-shadow-[0_40px_80px_rgba(0,0,0,.6)]"
            aria-hidden
          />
          <span
            className="absolute inset-x-16 bottom-3 h-14 rounded-[50%] blur-2xl"
            style={{ background: 'radial-gradient(ellipse, rgba(0,0,0,.6), transparent 70%)' }}
            aria-hidden
          />
        </motion.div>
      </div>
    </section>
  );
}
