import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Search, Send, Trash2, X } from 'lucide-react';

import ChatMessage from '@/components/ChatMessage';
import { Alert, ConfirmDialog, EmptyState, StatusBadge } from '@/components/ui';
import { shortDate } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import {
  deleteMessage, deleteThread, markThreadRead, messagesFor, sendMessage, subscribe,
  supportThreads,
} from '@/lib/store';

/**
 * The support desk: every member's thread on the left, the open one on the
 * right.
 *
 * Two filters, because they answer different questions. The search box narrows
 * *which* conversation — the user-wise filter, for when the list outgrows a
 * screen. The date range narrows *what was said inside it*, which is how you
 * find the exchange from the week a deposit went wrong without scrolling
 * through everything since.
 */
export default function AdminMessages() {
  const { user: admin } = useAuth();
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reply, setReply] = useState('');
  const [message, setMessage] = useState('');
  const [clearing, setClearing] = useState(false);
  const [, tick] = useState(0);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => subscribe(() => tick((n) => n + 1)), []);

  const threads = supportThreads();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) => t.email.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
    );
  }, [threads, search]);

  // Opening a thread marks the member's side as seen.
  useEffect(() => {
    if (openId) markThreadRead(openId, 'admin');
  }, [openId, threads.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  });

  const active = openId ? threads.find((t) => t.user_id === openId) ?? null : null;

  // The date range is applied here rather than in the store: it is a view of
  // the thread, not a different thread.
  const shown = openId
    ? messagesFor(openId).filter((m) => {
        const day = m.created_at.slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
      })
    : [];
  const total = openId ? messagesFor(openId).length : 0;
  const filteredByDate = Boolean(from || to);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!openId || !reply.trim()) return;
    sendMessage(openId, 'admin', reply, admin ? `${admin.first_name} ${admin.last_name}`.trim() : 'Admin Desk');
    setReply('');
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-3d sm:text-3xl">Messages</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every member who has written in. Replies land in their chat immediately.
        </p>
      </header>

      {message && (
        <div className="mt-5">
          <Alert kind="success" onDismiss={() => setMessage('')}>{message}</Alert>
        </div>
      )}

      {threads.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No messages yet"
            description="Threads appear here the moment a member writes in from their support chat."
            icon={<MessageCircle size={26} />}
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* ── Conversations ────────────────────────────────────────── */}
          <aside className="card flex max-h-[70vh] flex-col overflow-hidden p-0">
            <div className="relative border-b border-border p-3">
              <Search size={15} className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-text-dim" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name or email"
                aria-label="Filter conversations by member"
                className="input py-2 pl-9 text-sm"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-text-dim">No member matches.</p>
              ) : (
                filtered.map((t) => (
                  <button
                    key={t.user_id}
                    onClick={() => { setOpenId(t.user_id); setFrom(''); setTo(''); }}
                    className={`flex w-full flex-col gap-1 border-b border-border px-4 py-3 text-left transition ${
                      openId === t.user_id ? 'bg-accent/10' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{t.name}</span>
                      {t.unread > 0 && (
                        <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full
                                         bg-danger px-1 text-[10px] font-bold text-white">
                          {t.unread}
                        </span>
                      )}
                    </span>
                    <span className="truncate text-xs text-text-muted">
                      {t.last_sender === 'admin' && <span className="text-accent">You: </span>}
                      {t.last_body}
                    </span>
                    <span className="text-[10px] text-text-dim">
                      {shortDate(t.last_at)} · {t.messages} message{t.messages === 1 ? '' : 's'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* ── The open thread ──────────────────────────────────────── */}
          <section className="card flex max-h-[70vh] min-h-[420px] flex-col overflow-hidden p-0">
            {!active ? (
              <div className="grid flex-1 place-items-center px-6 text-center">
                <p className="text-sm text-text-muted">
                  Pick a conversation on the left to read it and reply.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {active.name} <StatusBadge status={active.kyc_status} />
                    </p>
                    <p className="truncate text-xs text-text-muted">{active.email}</p>
                  </div>
                  <button
                    onClick={() => setClearing(true)}
                    className="btn-danger px-3 py-1.5 text-xs"
                    title="Delete this whole conversation"
                  >
                    <Trash2 size={13} /> Delete conversation
                  </button>
                </div>

                {/* Date range — a view of the thread, not a different thread. */}
                <div className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-3">
                  <div>
                    <label className="label text-[10px]" htmlFor="from">From</label>
                    <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                           className="input py-1.5 text-xs" />
                  </div>
                  <div>
                    <label className="label text-[10px]" htmlFor="to">To</label>
                    <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)}
                           className="input py-1.5 text-xs" />
                  </div>
                  {filteredByDate && (
                    <button
                      onClick={() => { setFrom(''); setTo(''); }}
                      className="btn-ghost px-3 py-1.5 text-xs"
                    >
                      <X size={13} /> Clear
                    </button>
                  )}
                  <span className="ml-auto text-xs text-text-dim">
                    {filteredByDate ? `${shown.length} of ${total}` : `${total}`} message
                    {total === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                  {shown.length === 0 ? (
                    <p className="py-8 text-center text-sm text-text-dim">
                      {filteredByDate ? 'Nothing in that date range.' : 'No messages.'}
                    </p>
                  ) : (
                    <>
                      {shown.map((m) => (
                        <ChatMessage
                          key={m.id}
                          message={m}
                          // The desk's own replies hang right in this window.
                          mine={m.sender === 'admin'}
                          canDelete
                          onDelete={(id) => {
                            deleteMessage(id);
                            setMessage('Message deleted.');
                          }}
                        />
                      ))}
                      <div ref={endRef} />
                    </>
                  )}
                </div>

                <form onSubmit={send} className="flex items-end gap-2 border-t border-border px-4 py-3">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send(e as unknown as React.FormEvent);
                      }
                    }}
                    rows={1}
                    placeholder={`Reply to ${active.name}…`}
                    aria-label="Reply"
                    className="input max-h-32 min-h-[44px] flex-1 resize-y py-2.5 text-sm"
                  />
                  <button type="submit" disabled={!reply.trim()} className="btn-primary h-11 shrink-0 px-4">
                    <Send size={16} /> Send
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      )}

      <ConfirmDialog
        open={clearing}
        title="Delete this conversation?"
        body={
          active
            ? `Every message exchanged with ${active.name} is removed for both sides. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete conversation"
        onConfirm={() => {
          if (!openId) return;
          deleteThread(openId);
          setOpenId(null);
          setMessage('Conversation deleted.');
        }}
        onClose={() => setClearing(false)}
      />
    </div>
  );
}
