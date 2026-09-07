'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, MessageCircle, X } from 'lucide-react';

import ChatThread from '@/components/ChatThread';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * Floating support launcher — a real thread now, not a handoff.
 *
 * It used to compose a message and open WhatsApp, because there was no inbox
 * behind it. There is one now: what is typed here lands in the desk's queue
 * and the reply comes back into this same panel, with the same message menu
 * the full page has.
 *
 * Signed out there is nothing to attach a thread to, so the launcher does not
 * render at all rather than collecting words it cannot deliver.
 */
const POLL_IDLE = 45000;

export default function SupportChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const loadUnread = useCallback(async () => {
    try {
      const res = await api.get<{ unread: number }>('/support/messages/unread/');
      setUnread(res.unread);
    } catch {
      /* a failed poll is not worth a banner over the whole app */
    }
  }, []);

  // Only while closed: opening the panel reads the thread, which marks the
  // desk's replies seen and drops the badge to nothing anyway.
  useEffect(() => {
    if (!user || open) return;
    void loadUnread();
    const timer = window.setInterval(loadUnread, POLL_IDLE);
    return () => window.clearInterval(timer);
  }, [user, open, loadUnread]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

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

  if (!user) return null;

  return (
    <div
      ref={rootRef}
      className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 print:hidden"
    >
      {open && (
        <div className="panel flex h-[min(70vh,540px)] w-[min(92vw,370px)] animate-fade-up flex-col overflow-hidden rounded-2xl">
          <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.07] bg-accent/10 px-4 py-3">
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

          <ChatThread
            viewer="user"
            compact
            pollMs={8000}
            emptyHint={
              <p className="text-xs leading-relaxed text-text-muted">
                Ask anything — the desk answers here, and you will see the reply
                in this panel.
              </p>
            }
          />
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
