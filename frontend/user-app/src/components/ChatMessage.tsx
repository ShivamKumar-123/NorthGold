'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Trash2 } from 'lucide-react';

import { dateTime } from '@/lib/api';
import type { SupportMessage } from '@/lib/support';

/**
 * One bubble in a support thread.
 *
 * `mine` is about which side of the screen it sits on, not who wrote it — the
 * member's own words hang right in their window, and the same message hangs
 * left in the desk's. Passing it in keeps one component serving both.
 *
 * Copy and delete live in a toolbar that appears on hover and is always
 * present for keyboard and touch (`focus-within`, and no `hidden`) — hiding a
 * destructive control behind a pointer-only affordance makes it unreachable on
 * a phone, which is where most of these threads are read.
 */
export default function ChatMessage({
  message,
  mine,
  canDelete,
  onDelete,
}: {
  message: SupportMessage;
  mine: boolean;
  canDelete: boolean;
  onDelete?: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);

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
      // Clipboard access is refused on insecure origins and in some embedded
      // browsers. Selecting the text is the fallback that always works.
      const range = document.createRange();
      const node = document.getElementById(`msg-${message.id}`);
      if (node) {
        range.selectNodeContents(node);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }

  return (
    <div className={`group flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
      <div
        className={`relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-e1 ${
          mine
            ? 'rounded-br-md border border-accent/25 bg-accent/12 text-text'
            : 'rounded-bl-md border border-border bg-bg-card text-text'
        }`}
      >
        <p id={`msg-${message.id}`} className="whitespace-pre-wrap break-words">
          {message.body}
        </p>
      </div>

      <div
        className={`flex items-center gap-2 text-[10px] text-text-dim ${
          mine ? 'flex-row-reverse' : ''
        }`}
      >
        <span>{dateTime(message.created_at)}</span>
        {message.sender === 'admin' && message.author_name && (
          <span className="text-accent">{message.author_name}</span>
        )}

        <span className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150
                         focus-within:opacity-100 group-hover:opacity-100">
          <button
            onClick={copy}
            title="Copy this message"
            aria-label="Copy this message"
            className="rounded p-1 transition hover:bg-white/10 hover:text-text"
          >
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
          </button>
          {canDelete && onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              title="Delete this message"
              aria-label="Delete this message"
              className="rounded p-1 transition hover:bg-danger/15 hover:text-danger"
            >
              <Trash2 size={12} />
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
