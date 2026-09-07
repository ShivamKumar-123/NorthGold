import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';

import ChatThread from '@/components/ChatThread';
import { EmptyState, PageLoader } from '@/components/ui';
import { useRequireAuth } from '@/lib/auth';
import { markThreadRead, subscribe } from '@/lib/store';

/**
 * The whole conversation with the desk.
 *
 * The floating widget carries the same thread — it is the quick way in, and
 * this is where the history is readable without a 46vh scroller. Both render
 * the same `ChatThread`, so a message sent in one appears in the other with
 * every menu action behaving identically.
 */
export default function SupportPage() {
  const { user, loading } = useRequireAuth();
  const [, tick] = useState(0);

  useEffect(() => subscribe(() => tick((n) => n + 1)), []);

  useEffect(() => {
    if (user) markThreadRead(user.id, 'user');
  }, [user]);

  if (loading) return <PageLoader label="Loading your messages" />;
  if (!user) return null;

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
        <ChatThread
          threadUserId={user.id}
          viewer="user"
          viewerId={user.id}
          emptyHint={
            <EmptyState
              title="No messages yet"
              description="Write below and the desk will pick it up. Replies land on this page and in the chat bubble."
              icon={<MessageCircle size={26} />}
            />
          }
        />
      </div>
    </div>
  );
}
