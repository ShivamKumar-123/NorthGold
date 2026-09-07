import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, MessageCircle, Send, X } from 'lucide-react';

import ChatMessage from '@/components/ChatMessage';
import { useAuth } from '@/lib/auth';
import {
  deleteMessage, markThreadRead, messagesFor, sendMessage, subscribe, unreadForMember,
} from '@/lib/store';

/**
 * Floating support launcher — a real thread now, not a handoff.
 *
 * It used to compose a message and open WhatsApp, because there was no inbox
 * behind it. There is one now: what is typed here lands in the desk's queue
 * and the reply comes back into this same panel, so the widget no longer has
 * to send anybody somewhere else.
 *
 * Signed out there is nothing to attach a thread to, so the launcher does not
 * render at all rather than collecting words it cannot deliver.
 */
const QUICK = [
  'I want to make a cash deposit — what is the process?',
  'When will my monthly return be credited?',
  'I need help with a withdrawal request.',
];

export default function SupportChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [, tick] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => subscribe(() => tick((n) => n + 1)), []);

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

  // Opening the panel is what marks the desk's replies as read.
  useEffect(() => {
    if (open && user) markThreadRead(user.id, 'user');
  }, [open, user]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end' });
  });

  if (!user) return null;

  const messages = messagesFor(user.id);
  const unread = unreadForMember(user.id);

  function send(body: string) {
    if (!body.trim()) return;
    sendMessage(user!.id, 'user', body);
    setText('');
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
              to="/support"
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
                    onClick={() => send(q)}
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
                    onDelete={deleteMessage}
                  />
                ))}
                <div ref={endRef} />
              </>
            )}
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
          <span className="absolute -right-0.5 -top-0.5 z-10 grid h-5 min-w-[20px] place-items-center
                           rounded-full border-2 border-bg px-1 text-[10px] font-bold text-white"
                style={{ background: '#e11d48' }}>
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
