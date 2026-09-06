'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';

import { API_BASE } from '@/lib/api';

/**
 * Floating support launcher that hands the conversation to WhatsApp.
 *
 * Deliberately not a real in-app chat: there is no inbox behind it, and a
 * widget that looks like live chat but silently drops messages is worse than
 * no widget at all. The panel is a composer — it collects the question and
 * opens the thread on WhatsApp, where the desk already works.
 *
 * The number comes from admin settings; with none configured the launcher does
 * not render rather than opening a broken wa.me link.
 */

const QUICK = [
  'I want to make a cash deposit — what is the process?',
  'When will my monthly return be credited?',
  'I need help with a withdrawal request.',
  'How does the referral commission work?',
];

export default function SupportChat() {
  const [number, setNumber] = useState('');
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/core/public-settings/`);
        if (!res.ok) return;
        const data = (await res.json()) as { support_whatsapp?: string };
        // Digits only: wa.me rejects '+', spaces and dashes.
        const digits = (data.support_whatsapp || '').replace(/\D/g, '');
        if (alive) setNumber(digits);
      } catch {
        /* Support is a convenience — a failed lookup just hides the button. */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Escape closes, and a click outside dismisses. A floating panel that traps
  // the page is the most common complaint about widgets like this.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  if (!number) return null;

  function send(message: string) {
    const body = message.trim();
    if (!body) return;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(body)}`, '_blank', 'noopener');
    setText('');
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 print:hidden"
    >
      {open && (
        <div className="panel w-[min(92vw,340px)] animate-fade-up overflow-hidden rounded-2xl">
          <div className="flex items-center gap-3 border-b border-white/[0.07] bg-success/10 px-4 py-3">
            <span className="relative grid h-9 w-9 place-items-center rounded-full bg-success/20 text-success">
              <MessageCircle size={17} />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg-card bg-success" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">NorthGold support</p>
              <p className="text-[11px] text-success">Replies on WhatsApp</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close support"
              className="rounded-lg p-1.5 text-text-dim transition hover:bg-white/5 hover:text-text"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-2 px-4 py-4">
            <p className="text-xs leading-relaxed text-text-muted">
              Pick a question or write your own — it opens in WhatsApp with the
              message ready to send.
            </p>
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="block w-full rounded-xl border border-border bg-white/[0.03] px-3 py-2.5 text-left
                           text-[13px] leading-snug text-text-muted transition
                           hover:border-accent/40 hover:text-text"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
            className="flex items-center gap-2 border-t border-white/[0.07] px-3 py-3"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message…"
              aria-label="Message to support"
              className="input flex-1 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              aria-label="Open in WhatsApp"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success text-[#052e16]
                         transition hover:brightness-110 disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        aria-expanded={open}
        className="group relative grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-[#052e16]
                   shadow-[0_10px_30px_-8px_rgba(37,211,102,.75)] transition-transform duration-200
                   hover:scale-105 active:scale-95"
      >
        {/* Attention ring, only while the panel has never been opened. */}
        {!open && (
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-[#25D366]/40" aria-hidden />
        )}
        {open ? <X size={22} /> : <WhatsAppGlyph />}
      </button>
    </div>
  );
}

/**
 * WhatsApp's mark. lucide ships no brand icons, and a generic speech bubble
 * would not tell anyone which app the button is about to open.
 */
function WhatsAppGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15s-.77.97-.94 1.17c-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.6 2 2.18 6.42 2.18 11.86c0 1.74.46 3.44 1.32 4.94L2 22l5.35-1.4a9.83 9.83 0 0 0 4.69 1.19h.01c5.43 0 9.85-4.42 9.85-9.86A9.79 9.79 0 0 0 12.04 2zm0 17.94a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.13 8.13 0 0 1-1.25-4.34c0-4.51 3.68-8.18 8.19-8.18a8.15 8.15 0 0 1 8.18 8.19c0 4.51-3.67 8.17-8.18 8.17z" />
    </svg>
  );
}
