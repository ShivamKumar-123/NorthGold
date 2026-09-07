'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';

import ChatMessage from '@/components/ChatMessage';
import { Alert, EmptyState, PageLoader } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import type { SupportMessage } from '@/lib/support';

const POLL = 10000;

/**
 * The whole conversation with the desk.
 *
 * The floating widget carries the same thread — it is the quick way in, and
 * this is where the history is readable without a 46vh scroller.
 */
export default function SupportPage() {
  const { user, loading: authLoading } = useRequireAuth();

  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ items: SupportMessage[] }>('/support/messages/');
      setMessages(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your messages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
    const timer = window.setInterval(load, POLL);
    return () => window.clearInterval(timer);
  }, [user, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (authLoading || (loading && !messages.length)) {
    return <PageLoader label="Loading your messages" />;
  }
  if (!user) return null;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      await api.post('/support/messages/', { body: text });
      setText('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send that message.');
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.del(`/support/messages/${id}/`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete that message.');
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col px-4 py-8 sm:px-6">
      <header className="shrink-0">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          <MessageCircle size={22} className="text-accent" /> Support
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Ask anything about your deposits, returns or network. The desk replies here.
        </p>
      </header>

      {error && (
        <div className="mt-5 shrink-0">
          <Alert kind="error" onDismiss={() => setError('')}>{error}</Alert>
        </div>
      )}

      <div className="card mt-6 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
          {messages.length === 0 ? (
            <EmptyState
              title="No messages yet"
              description="Write below and the desk will pick it up. Replies land on this page and in the chat bubble."
              icon={<MessageCircle size={26} />}
            />
          ) : (
            <>
              {messages.map((m) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  mine={m.sender === 'user'}
                  // Members may remove their own words but not the answer they
                  // were given — deleting that would erase the record of it.
                  canDelete={m.sender === 'user'}
                  onDelete={(id) => void remove(id)}
                />
              ))}
              <div ref={endRef} />
            </>
          )}
        </div>

        <form onSubmit={send} className="flex items-end gap-2 border-t border-border px-4 py-3 sm:px-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — the convention
              // every other chat box already follows.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(e as unknown as React.FormEvent);
              }
            }}
            rows={1}
            placeholder="Type your message…"
            aria-label="Message to support"
            className="input max-h-32 min-h-[44px] flex-1 resize-y py-2.5 text-sm"
          />
          <button type="submit" disabled={!text.trim() || sending} className="btn-primary h-11 shrink-0 px-4">
            <Send size={16} /> Send
          </button>
        </form>
      </div>
    </div>
  );
}
