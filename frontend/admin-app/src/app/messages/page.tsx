'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, MessageCircle, Search, Send, Trash2, X } from 'lucide-react';

import { Alert, EmptyState, Modal, PageLoader, StatusBadge } from '@/components/ui';
import { ApiError, api, dateTime, shortDate } from '@/lib/api';
import { useRequireAdmin } from '@/lib/auth';

type Thread = {
  user_id: string;
  name: string;
  email: string;
  kyc_status: string;
  messages: number;
  unread: number;
  last_at: string;
  last_sender: string;
  last_body: string;
};

type Message = {
  id: string;
  sender: 'user' | 'admin';
  author_name: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

const POLL = 12000;

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
export default function MessagesPage() {
  const { admin, loading: authLoading } = useRequireAdmin();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reply, setReply] = useState('');
  const [clearing, setClearing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadThreads = useCallback(async () => {
    try {
      const res = await api.get<{ items: Thread[] }>('/support/admin/threads/');
      setThreads(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the inbox.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadThread = useCallback(async () => {
    if (!openId) return;
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    try {
      const res = await api.get<{ items: Message[] }>(
        `/support/admin/threads/${openId}/${query ? `?${query}` : ''}`,
      );
      setMessages(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load that conversation.');
    }
  }, [openId, from, to]);

  useEffect(() => {
    if (!admin) return;
    void loadThreads();
    const timer = window.setInterval(loadThreads, POLL);
    return () => window.clearInterval(timer);
  }, [admin, loadThreads]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter(
      (t) => t.email.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
    );
  }, [threads, search]);

  if (authLoading) return <PageLoader label="Loading messages" />;
  if (!admin) return null;

  const active = threads.find((t) => t.user_id === openId) ?? null;
  const filteredByDate = Boolean(from || to);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!openId || !reply.trim()) return;
    try {
      await api.post(`/support/admin/threads/${openId}/`, { body: reply });
      setReply('');
      await Promise.all([loadThread(), loadThreads()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send that reply.');
    }
  }

  async function removeMessage(id: string) {
    try {
      await api.del(`/support/admin/messages/${id}/`);
      setNotice('Message deleted.');
      await Promise.all([loadThread(), loadThreads()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that message.');
    }
  }

  async function removeThread() {
    if (!openId) return;
    try {
      await api.del(`/support/admin/threads/${openId}/`);
      setOpenId(null);
      setMessages([]);
      setNotice('Conversation deleted.');
      await loadThreads();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that conversation.');
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Messages</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every member who has written in. Replies land in their chat immediately.
        </p>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-5"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

      {loading && !threads.length ? (
        <div className="mt-6"><PageLoader label="Loading the inbox" /></div>
      ) : threads.length === 0 ? (
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
                    <button onClick={() => { setFrom(''); setTo(''); }} className="btn-ghost px-3 py-1.5 text-xs">
                      <X size={13} /> Clear
                    </button>
                  )}
                  <span className="ml-auto text-xs text-text-dim">
                    {messages.length} of {active.messages} message{active.messages === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
                  {messages.length === 0 ? (
                    <p className="py-8 text-center text-sm text-text-dim">
                      {filteredByDate ? 'Nothing in that date range.' : 'No messages.'}
                    </p>
                  ) : (
                    <>
                      {messages.map((m) => (
                        <Bubble
                          key={m.id}
                          message={m}
                          onDelete={() => void removeMessage(m.id)}
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
                        void send(e as unknown as React.FormEvent);
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

      <Modal
        open={clearing}
        title="Delete this conversation?"
        onClose={() => setClearing(false)}
        width="max-w-md"
        footer={
          <>
            <button onClick={() => setClearing(false)} className="btn-ghost px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              onClick={() => { setClearing(false); void removeThread(); }}
              className="btn-danger px-4 py-2 text-sm"
            >
              Delete conversation
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-text-muted">
          {active
            ? `Every message exchanged with ${active.name} is removed for both sides. This cannot be undone.`
            : ''}
        </p>
      </Modal>
    </div>
  );
}

/**
 * One bubble. The desk's own replies hang right in this window — `mine` is
 * about which side of the screen it sits on, not who wrote it.
 */
function Bubble({ message, onDelete }: { message: Message; onDelete: () => void }) {
  const [copied, setCopied] = useState(false);
  const mine = message.sender === 'admin';

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.body);
      setCopied(true);
    } catch {
      /* clipboard is refused on insecure origins; the text stays selectable */
    }
  }

  return (
    <div className={`group flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-e1 ${
          mine
            ? 'rounded-br-md border border-accent/25 bg-accent/12 text-text'
            : 'rounded-bl-md border border-border bg-bg-card text-text'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
      </div>

      <div className={`flex items-center gap-2 text-[10px] text-text-dim ${mine ? 'flex-row-reverse' : ''}`}>
        <span>{dateTime(message.created_at)}</span>
        {mine && message.author_name && <span className="text-accent">{message.author_name}</span>}
        <span className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150
                         focus-within:opacity-100 group-hover:opacity-100">
          <button
            onClick={() => void copy()}
            title="Copy this message"
            aria-label="Copy this message"
            className="rounded p-1 transition hover:bg-white/10 hover:text-text"
          >
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          </button>
          <button
            onClick={onDelete}
            title="Delete this message"
            aria-label="Delete this message"
            className="rounded p-1 transition hover:bg-danger/15 hover:text-danger"
          >
            <Trash2 size={12} />
          </button>
        </span>
      </div>
    </div>
  );
}
