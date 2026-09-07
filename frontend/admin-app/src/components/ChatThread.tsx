'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CornerUpLeft, Search, Send, Star, X } from 'lucide-react';

import ChatMessage from '@/components/ChatMessage';
import { Alert, EmptyState, Modal } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import type { SupportMessage } from '@/lib/support';

type ForwardTarget = { user_id: string; name: string; email: string };

/**
 * A whole conversation: the messages, the menu actions on them, and the box
 * that writes the next one.
 *
 * One component for all three surfaces — the floating widget, the member's
 * Support page and the desk's inbox — because the rules about what a message
 * menu may do are the same wherever the thread is drawn. Only the endpoint it
 * reads and writes differs, which `viewer` decides.
 *
 * Reacting, starring and editing hit the shared per-message endpoints, so this
 * needs no branch for them: the API answers the same question ("may I see this
 * thread?") whichever side is asking.
 */
export default function ChatThread({
  viewer,
  threadUserId,
  compact = false,
  dateFrom = '',
  dateTo = '',
  pollMs = 10000,
  emptyHint,
  onChanged,
}: {
  viewer: 'user' | 'admin';
  /** Required for the desk; a member's own thread needs no id. */
  threadUserId?: string;
  compact?: boolean;
  dateFrom?: string;
  dateTo?: string;
  pollMs?: number;
  emptyHint?: React.ReactNode;
  /** Lets the inbox refresh its thread list after a send or delete. */
  onChanged?: () => void;
}) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<SupportMessage | null>(null);
  const [forwarding, setForwarding] = useState<SupportMessage | null>(null);
  const [targets, setTargets] = useState<ForwardTarget[]>([]);
  const [forwardSearch, setForwardSearch] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const base = viewer === 'admin'
    ? `/support/admin/threads/${threadUserId}/`
    : '/support/messages/';

  const load = useCallback(async () => {
    if (viewer === 'admin' && !threadUserId) return;
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (starredOnly) params.set('starred', '1');
    const query = params.toString();
    try {
      const res = await api.get<{ items: SupportMessage[] }>(
        `${base}${query ? `?${query}` : ''}`,
      );
      setMessages(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the conversation.');
    }
  }, [base, viewer, threadUserId, dateFrom, dateTo, starredOnly]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(load, pollMs);
    return () => window.clearInterval(timer);
  }, [load, pollMs]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function run(action: () => Promise<unknown>, failure: string) {
    setError('');
    try {
      await action();
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : failure);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const body = text;
    const quote = replyTo?.id ?? null;
    setText('');
    setReplyTo(null);
    await run(
      () => api.post(base, { body, reply_to: quote }),
      'Could not send that message.',
    );
  }

  function jumpTo(id: string) {
    document.getElementById(`bubble-${id}`)?.scrollIntoView({
      behavior: 'smooth', block: 'center',
    });
  }

  // Forwarding copies the text into another conversation. The desk picks any
  // member; a member has exactly one conversation — the desk — so their picker
  // holds a single row rather than pretending there is a choice.
  async function openForward(message: SupportMessage) {
    setForwarding(message);
    setForwardSearch('');
    if (viewer !== 'admin') {
      setTargets([{ user_id: 'me', name: 'NorthGold support', email: 'The desk' }]);
      return;
    }
    try {
      const res = await api.get<{ items: ForwardTarget[] }>('/support/admin/threads/?all=1');
      setTargets(res.items);
    } catch {
      setTargets([]);
    }
  }

  async function forwardTo(target: ForwardTarget) {
    if (!forwarding) return;
    const body = forwarding.body;
    setForwarding(null);
    await run(
      () => api.post(
        viewer === 'admin' ? `/support/admin/threads/${target.user_id}/` : '/support/messages/',
        { body, forwarded: true },
      ),
      'Could not forward that message.',
    );
  }

  const filteredTargets = targets.filter((t) => {
    const q = forwardSearch.trim().toLowerCase();
    if (!q) return true;
    return t.email.toLowerCase().includes(q) || t.name.toLowerCase().includes(q);
  });

  const anyStarred = messages.some((m) => m.starred) || starredOnly;

  return (
    <>
      {error && (
        <div className="shrink-0 px-4 pt-3">
          <Alert kind="error" onDismiss={() => setError('')}>{error}</Alert>
        </div>
      )}

      {anyStarred && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2">
          <button
            onClick={() => setStarredOnly((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition ${
              starredOnly
                ? 'border-accent/50 bg-accent/15 text-accent'
                : 'border-border text-text-muted hover:text-text'
            }`}
          >
            <Star size={11} className={starredOnly ? 'fill-accent' : ''} />
            Starred
          </button>
          {starredOnly && <span className="text-[11px] text-text-dim">Showing starred only</span>}
        </div>
      )}

      <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto ${compact ? 'px-4 py-4' : 'px-4 py-5 sm:px-6'}`}>
        {messages.length === 0 ? (
          starredOnly || dateFrom || dateTo ? (
            <p className="py-8 text-center text-sm text-text-dim">
              {starredOnly ? 'Nothing starred here.' : 'Nothing in that date range.'}
            </p>
          ) : (
            emptyHint ?? (
              <EmptyState title="No messages yet" description="Write below to start the conversation." />
            )
          )
        ) : (
          <>
            {messages.map((m) => (
              <ChatMessage
                key={m.id}
                message={m}
                mine={m.sender === viewer}
                // The desk may remove anything; a member only their own words,
                // because deleting the reply would erase the answer they got.
                canDelete={viewer === 'admin' || m.sender === 'user'}
                onReply={setReplyTo}
                onForward={(msg) => void openForward(msg)}
                onDelete={(id) => void run(
                  () => api.del(`/support/messages/${id}/`), 'Could not delete that message.',
                )}
                onReact={(id, emoji) => void run(
                  () => api.post(`/support/messages/${id}/react/`, { emoji }), 'Could not react.',
                )}
                onStar={(id) => void run(
                  () => api.post(`/support/messages/${id}/star/`), 'Could not star that message.',
                )}
                onEdit={(id, body) => void run(
                  () => api.patch(`/support/messages/${id}/`, { body }), 'Could not edit that message.',
                )}
                onJumpTo={jumpTo}
              />
            ))}
            <div ref={endRef} />
          </>
        )}
      </div>

      <form onSubmit={send} className={`shrink-0 border-t border-border ${compact ? 'px-3 py-3' : 'px-4 py-3 sm:px-6'}`}>
        {replyTo && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border-l-2 border-accent bg-white/[0.04] px-2.5 py-1.5">
            <CornerUpLeft size={12} className="mt-0.5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-accent">
                Replying to {replyTo.sender === viewer ? 'yourself' : 'them'}
              </p>
              <p className="line-clamp-2 text-[11px] text-text-muted">{replyTo.body}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Cancel reply"
              className="shrink-0 rounded p-0.5 text-text-dim hover:text-text"
            >
              <X size={13} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — the convention every
              // other chat box already follows.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(e as unknown as React.FormEvent);
              }
            }}
            rows={1}
            placeholder="Type your message…"
            aria-label="Message"
            className="input max-h-32 min-h-[44px] flex-1 resize-y py-2.5 text-sm"
          />
          <button type="submit" disabled={!text.trim()} className="btn-primary h-11 shrink-0 px-4">
            <Send size={16} />
            {!compact && <span>Send</span>}
          </button>
        </div>
      </form>

      <Modal
        open={Boolean(forwarding)}
        title="Forward message"
        onClose={() => setForwarding(null)}
        width="max-w-md"
      >
        <div className="rounded-lg border-l-2 border-accent bg-white/[0.04] px-3 py-2">
          <p className="line-clamp-3 text-xs text-text-muted">{forwarding?.body}</p>
        </div>

        {viewer === 'admin' && (
          <div className="relative mt-4">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              value={forwardSearch}
              onChange={(e) => setForwardSearch(e.target.value)}
              placeholder="Search members"
              className="input py-2 pl-8 text-sm"
            />
          </div>
        )}

        <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
          {filteredTargets.length === 0 ? (
            <p className="py-4 text-center text-sm text-text-dim">No member matches.</p>
          ) : (
            filteredTargets.map((t) => (
              <button
                key={t.user_id}
                onClick={() => void forwardTo(t)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border
                           px-3 py-2.5 text-left transition hover:border-accent/45 hover:bg-white/[0.04]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{t.name}</span>
                  <span className="block truncate text-xs text-text-muted">{t.email}</span>
                </span>
                <span className="shrink-0 text-xs text-accent">Send</span>
              </button>
            ))
          )}
        </div>
      </Modal>
    </>
  );
}
