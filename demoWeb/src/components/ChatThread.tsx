import { useEffect, useMemo, useRef, useState } from 'react';
import { CornerUpLeft, Search, Send, Smile, Star, X } from 'lucide-react';

import ChatMessage from '@/components/ChatMessage';
import EmojiPicker from '@/components/EmojiPicker';
import { EmptyState, Modal } from '@/components/ui';
import {
  deleteMessage, editMessage, getUsers, messagesFor, sendMessage, toggleReaction, toggleStar,
} from '@/lib/store';
import type { SupportMessage } from '@/lib/types';

/**
 * A whole conversation: the messages, the menu actions on them, and the box
 * that writes the next one.
 *
 * One component for all three surfaces — the floating widget, the member's
 * Support page and the desk's inbox — because the rules about what a message
 * menu may do are the same wherever the thread is drawn. Only the chrome
 * around it differs, which is what `compact` and the caller's layout handle.
 */
export default function ChatThread({
  threadUserId,
  viewer,
  viewerId,
  authorName = '',
  compact = false,
  dateFrom = '',
  dateTo = '',
  emptyHint,
}: {
  threadUserId: string;
  viewer: 'user' | 'admin';
  viewerId: string;
  authorName?: string;
  compact?: boolean;
  dateFrom?: string;
  dateTo?: string;
  emptyHint?: React.ReactNode;
}) {
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<SupportMessage | null>(null);
  const [forwarding, setForwarding] = useState<SupportMessage | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const boxRef = useRef<HTMLTextAreaElement | null>(null);
  const emojiRef = useRef<HTMLDivElement | null>(null);

  const all = messagesFor(threadUserId);
  const byId = useMemo(() => new Map(all.map((m) => [m.id, m])), [all]);

  const shown = all.filter((m) => {
    const day = m.created_at.slice(0, 10);
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    if (starredOnly && !(m.starred_by ?? []).includes(viewerId)) return false;
    return true;
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [all.length]);

  useEffect(() => {
    if (!emojiOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEmojiOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setEmojiOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [emojiOpen]);

  /** Insert at the caret rather than appending — somebody who has gone back to
   *  fix a word mid-sentence expects the emoji where they are looking. */
  function insertEmoji(emoji: string) {
    const box = boxRef.current;
    if (!box) {
      setText((t) => t + emoji);
      return;
    }
    const start = box.selectionStart ?? text.length;
    const end = box.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      box.focus();
      const at = start + emoji.length;
      box.setSelectionRange(at, at);
    });
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    sendMessage(threadUserId, viewer, text, authorName, { replyTo: replyTo?.id ?? null });
    setText('');
    setReplyTo(null);
  }

  function jumpTo(id: string) {
    document.getElementById(`bubble-${id}`)?.scrollIntoView({
      behavior: 'smooth', block: 'center',
    });
  }

  // Forwarding copies the text into another conversation. The desk picks any
  // member; a member has exactly one conversation — the desk — so their picker
  // holds a single row rather than pretending there is a choice.
  const forwardTargets = viewer === 'admin'
    ? getUsers().filter((u) => !u.is_staff)
    : getUsers().filter((u) => u.id === threadUserId);
  const filteredTargets = forwardTargets.filter((u) => {
    const q = forwardSearch.trim().toLowerCase();
    if (!q) return true;
    return u.email.toLowerCase().includes(q)
      || `${u.first_name} ${u.last_name}`.toLowerCase().includes(q);
  });

  const starredCount = all.filter((m) => (m.starred_by ?? []).includes(viewerId)).length;

  return (
    <>
      {starredCount > 0 && (
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
            Starred ({starredCount})
          </button>
          {starredOnly && (
            <span className="text-[11px] text-text-dim">
              Showing starred only
            </span>
          )}
        </div>
      )}

      <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto ${compact ? 'px-4 py-4' : 'px-4 py-5 sm:px-6'}`}>
        {shown.length === 0 ? (
          all.length === 0 ? (
            emptyHint ?? (
              <EmptyState title="No messages yet" description="Write below to start the conversation." />
            )
          ) : (
            <p className="py-8 text-center text-sm text-text-dim">
              {starredOnly ? 'Nothing starred here.' : 'Nothing in that date range.'}
            </p>
          )
        ) : (
          <>
            {shown.map((m) => (
              <ChatMessage
                key={m.id}
                message={m}
                quoted={m.reply_to ? byId.get(m.reply_to) ?? null : null}
                mine={m.sender === viewer}
                viewerId={viewerId}
                // The desk may remove anything; a member only their own words,
                // because deleting the reply would erase the answer they got.
                canDelete={viewer === 'admin' || m.sender === 'user'}
                canEdit={m.sender === viewer && !m.read_at}
                onReply={setReplyTo}
                onForward={(msg) => { setForwarding(msg); setForwardSearch(''); }}
                onDelete={deleteMessage}
                onReact={(id, emoji) => toggleReaction(id, viewerId, emoji)}
                onStar={(id) => toggleStar(id, viewerId)}
                onEdit={(id, body) => editMessage(id, viewer, body)}
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
                Replying to {replyTo.sender === 'admin' ? replyTo.author_name || 'Support' : 'them'}
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
          <div className="relative" ref={emojiRef}>
            {emojiOpen && (
              <div className="absolute bottom-12 left-0 z-40">
                <EmojiPicker onPick={insertEmoji} />
              </div>
            )}
            <button
              type="button"
              onClick={() => setEmojiOpen((v) => !v)}
              aria-label="Insert emoji"
              aria-expanded={emojiOpen}
              className={`grid h-11 w-10 place-items-center rounded-xl border border-border transition ${
                emojiOpen ? 'border-accent/45 bg-accent/10 text-accent' : 'text-text-muted hover:text-text'
              }`}
            >
              <Smile size={18} />
            </button>
          </div>
          <textarea
            ref={boxRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter breaks the line — the convention every
              // other chat box already follows.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(e as unknown as React.FormEvent);
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
            filteredTargets.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  if (!forwarding) return;
                  sendMessage(u.id, viewer, forwarding.body, authorName, { forwarded: true });
                  setForwarding(null);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border
                           px-3 py-2.5 text-left transition hover:border-accent/45 hover:bg-white/[0.04]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">
                    {`${u.first_name} ${u.last_name}`.trim() || u.email}
                  </span>
                  <span className="block truncate text-xs text-text-muted">{u.email}</span>
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
