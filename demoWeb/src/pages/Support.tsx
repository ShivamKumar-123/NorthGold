import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';

import ChatMessage from '@/components/ChatMessage';
import { EmptyState, PageLoader } from '@/components/ui';
import { useRequireAuth } from '@/lib/auth';
import {
  deleteMessage, markThreadRead, messagesFor, sendMessage, subscribe,
} from '@/lib/store';

/**
 * The whole conversation with the desk.
 *
 * The floating widget carries the same thread — it is the quick way in, and
 * this is where the history is readable without a 46vh scroller. Both write to
 * the same store, so a message sent in one appears in the other immediately.
 */
export default function SupportPage() {
  const { user, loading } = useRequireAuth();
  const [text, setText] = useState('');
  const [, tick] = useState(0);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => subscribe(() => tick((n) => n + 1)), []);

  useEffect(() => {
    if (user) markThreadRead(user.id, 'user');
  }, [user]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  });

  if (loading) return <PageLoader label="Loading your messages" />;
  if (!user) return null;

  const messages = messagesFor(user.id);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(user!.id, 'user', text);
    setText('');
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
                  onDelete={deleteMessage}
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
              // every other chat box on a phone already follows.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(e as unknown as React.FormEvent);
              }
            }}
            rows={1}
            placeholder="Type your message…"
            aria-label="Message to support"
            className="input max-h-32 min-h-[44px] flex-1 resize-y py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="btn-primary h-11 shrink-0 px-4"
          >
            <Send size={16} /> Send
          </button>
        </form>
      </div>
    </div>
  );
}
