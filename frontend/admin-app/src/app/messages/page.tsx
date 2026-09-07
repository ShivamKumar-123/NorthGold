'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Search, Trash2, X } from 'lucide-react';

import ChatThread from '@/components/ChatThread';
import { Alert, EmptyState, Modal, PageLoader, StatusBadge } from '@/components/ui';
import { ApiError, api, shortDate } from '@/lib/api';
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
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [clearing, setClearing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

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

  useEffect(() => {
    if (!admin) return;
    void loadThreads();
    const timer = window.setInterval(loadThreads, POLL);
    return () => window.clearInterval(timer);
  }, [admin, loadThreads]);

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

  async function removeThread() {
    if (!openId) return;
    try {
      await api.del(`/support/admin/threads/${openId}/`);
      setOpenId(null);
      setNotice('Conversation deleted.');
      await loadThreads();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that conversation.');
    }
  }

  /* Full height and full width. The admin rail is fixed, so on a large
     screen the only chrome above this is the mobile header — hence the two
     heights. Everything inside is min-h-0, so the two panels scroll rather
     than the page: an inbox is somewhere you sit, not a card you glance at. */
  return (
    <div className="flex h-[calc(100vh-74px)] flex-col px-4 py-6 sm:px-6 lg:h-screen lg:py-8">
      <header className="shrink-0">
        <h1 className="text-2xl font-semibold sm:text-3xl">Messages</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every member who has written in. Replies land in their chat immediately.
        </p>
      </header>

      {error && <div className="mt-5 shrink-0"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-5 shrink-0"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

      {loading && !threads.length ? (
        <div className="mt-6 shrink-0"><PageLoader label="Loading the inbox" /></div>
      ) : threads.length === 0 ? (
        <div className="mt-6 shrink-0">
          <EmptyState
            title="No messages yet"
            description="Threads appear here the moment a member writes in from their support chat."
            icon={<MessageCircle size={26} />}
          />
        </div>
      ) : (
        <div className="mt-5 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
          {/* ── Conversations ────────────────────────────────────────── */}
          <aside className="card flex min-h-0 flex-col overflow-hidden p-0 max-lg:max-h-[38vh]">
            <div className="relative shrink-0 border-b border-border p-3">
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
          <section className="card flex min-h-0 flex-col overflow-hidden p-0 max-lg:min-h-[420px]">
            {!active ? (
              <div className="grid flex-1 place-items-center px-6 text-center">
                <p className="text-sm text-text-muted">
                  Pick a conversation on the left to read it and reply.
                </p>
              </div>
            ) : (
              <>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
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
                <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-border px-4 py-3">
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
                    {active.messages} message{active.messages === 1 ? '' : 's'}
                  </span>
                </div>

                <ChatThread
                  viewer="admin"
                  threadUserId={active.user_id}
                  dateFrom={from}
                  dateTo={to}
                  pollMs={12000}
                  onChanged={() => void loadThreads()}
                />
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
