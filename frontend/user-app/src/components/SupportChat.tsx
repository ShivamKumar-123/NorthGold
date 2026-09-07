'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, MessageCircle, Send, X } from 'lucide-react';

import ChatMessage from '@/components/ChatMessage';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { SupportMessage } from '@/lib/support';

/**
 * Floating support launcher — a real thread now, not a handoff.
 *
 * It used to compose a message and open WhatsApp, because there was no inbox
 * behind it. There is one now: what is typed here lands in the desk's queue
 * and the reply comes back into this same panel.
 *
 * Signed out there is nothing to attach a thread to, so the launcher does not
 * render at all rather than collecting words it cannot deliver.
 */
const QUICK = [
  'I want to make a cash deposit — what is the process?',
  'When will my monthly return be credited?',
  'I need help with a withdrawal request.',
];

// Polled rather than pushed. The WebSocket in this codebase carries public
// price ticks; putting a private thread on it would mean authenticating the
// socket, and a support desk answers in minutes, not milliseconds.
const POLL_OPEN = 8000;
const POLL_IDLE = 45000;

export default function SupportChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadThread = useCallback(async () => {
    try {
      const res = await api.get<{ items: SupportMessage[] }>('/support/messages/');
      setMessages(res.items);
      setUnread(0);
    } catch {
      /* a failed poll is not worth a banner over the whole app */
    }
  }, []);

  const loadUnread = useCallback(async () => {
    try {
      const res = await api.get<{ unread: number }>('/support/messages/unread/');
      setUnread(res.unread);
    } catch {
      /* ignore */
    }
  }, []);

  // Open: read the thread (which marks replies seen). Closed: just the badge.
  useEffect(() => {
    if (!user) return;
    const run = open ? loadThread : loadUnread;
    void run();
    const timer = window.setInterval(run, open ? POLL_OPEN : POLL_IDLE);
    return () => window.clearInterval(timer);
  }, [user, open, loadThread, loadUnread]);

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

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end' });
  }, [open, messages.length]);

  if (!user) return null;

  async function send(body: string) {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await api.post('/support/messages/', { body });
      setText('');
      await loadThread();
    } catch {
      /* surfaced by the thread failing to grow — the box keeps the text */
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.del(`/support/messages/${id}/`);
      await loadThread();
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      ref={rootRef}
      className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 print:hidden"
    >
      {open && (
        <div className="panel flex w-[min(92vw,360px)] animate-fade-up flex-col overflow-hidden rounded-2xl">
          <div className="flex items-center gap-3 border-b border-white/[0.07] bg-accent/10 px-4 py-3">
            <span className="relative grid h-9 w-9 place-items-center rounded-full bg-accent/20 text-accent">
              <MessageCircle size={17} />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg-card bg-success" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">NorthGold support</p>
              <p className="text-[11px] text-success">We reply here</p>
            </div>
            <Link
              href="/support"
              onClick={() => setOpen(false)}
              title="Open the full conversation"
              className="rounded-lg p-1.5 text-text-dim transition hover:bg-white/5 hover:text-text"
            >
              <ArrowUpRight size={16} />
            </Link>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close support"
              className="rounded-lg p-1.5 text-text-dim transition hover:bg-white/5 hover:text-text"
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[46vh] min-h-[140px] space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs leading-relaxed text-text-muted">
                  Ask anything — the desk answers here, and you will see the
                  reply in this panel.
                </p>
                {QUICK.map((q) => (
                  <button
                    key={q}
                    onClick={() => void send(q)}
                    className="block w-full rounded-xl border border-border bg-white/[0.03] px-3 py-2.5 text-left
                               text-[13px] leading-snug text-text-muted transition
                               hover:border-accent/40 hover:text-text"
                  >
                    {q}
                  </button>
                ))}
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <ChatMessage
                    key={m.id}
                    message={m}
                    mine={m.sender === 'user'}
                    canDelete={m.sender === 'user'}
                    onDelete={(id) => void remove(id)}
                  />
                ))}
                <div ref={endRef} />
              </>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
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
              disabled={!text.trim() || sending}
              aria-label="Send"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-[#1b1403]
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
        className="group relative grid h-14 w-14 place-items-center rounded-full bg-accent text-[#1b1403]
                   shadow-[0_10px_30px_-8px_rgba(217,166,46,.75)] transition-transform duration-200
                   hover:scale-105 active:scale-95"
      >
        {!open && unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 z-10 grid h-5 min-w-[20px] place-items-center
                       rounded-full border-2 border-bg px-1 text-[10px] font-bold text-white"
            style={{ background: '#e11d48' }}
          >
            {unread}
          </span>
        )}
        {!open && (
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent/40" aria-hidden />
        )}
        {open ? <X size={22} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}
