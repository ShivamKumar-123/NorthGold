'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Check, Copy, CornerUpLeft, Forward, Pencil, SmilePlus, Star, Trash2, X,
} from 'lucide-react';

import EmojiPicker from '@/components/EmojiPicker';
import { dateTime } from '@/lib/api';
import { QUICK_REACTIONS } from '@/lib/emoji';
import type { SupportMessage } from '@/lib/support';

/**
 * One bubble in a support thread, with the menu that opens on it.
 *
 * `mine` is about which side of the screen it sits on, not who wrote it — the
 * member's own words hang right in their window, and the same message hangs
 * left in the desk's. Passing it in keeps one component serving both.
 *
 * The menu opens on a click anywhere on the bubble, which is the gesture
 * people already use. What it offers depends on who is looking: anybody may
 * reply, react, star, forward and copy; only the author may edit, and only
 * while the other side has not read it, which the API decides and reports back
 * as `can_edit`.
 */
export default function ChatMessage({
  message,
  mine,
  canDelete,
  onReply,
  onForward,
  onDelete,
  onReact,
  onStar,
  onEdit,
  onJumpTo,
}: {
  message: SupportMessage;
  mine: boolean;
  canDelete: boolean;
  onReply?: (message: SupportMessage) => void;
  onForward?: (message: SupportMessage) => void;
  onDelete?: (id: string) => void;
  onReact?: (id: string, emoji: string) => void;
  onStar?: (id: string) => void;
  onEdit?: (id: string, body: string) => void;
  onJumpTo?: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const counts = Object.entries(message.reaction_counts ?? {}).filter(([, n]) => n > 0);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenuOpen(false); setPickerOpen(false); }
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setPickerOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [menuOpen]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.body);
      setCopied(true);
    } catch {
      // Clipboard access is refused on insecure origins and in some embedded
      // browsers. Selecting the text is the fallback that always works.
      const node = document.getElementById(`msg-${message.id}`);
      if (node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
    setMenuOpen(false);
  }

  function act(fn?: () => void) {
    fn?.();
    setMenuOpen(false);
  }

  function saveEdit() {
    if (!draft.trim() || draft.trim() === message.body) {
      setEditing(false);
      return;
    }
    onEdit?.(message.id, draft.trim());
    setEditing(false);
  }

  return (
    <div
      ref={rootRef}
      id={`bubble-${message.id}`}
      className={`group relative flex scroll-mt-8 flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}
    >
      <div className="relative max-w-[85%]">
        <div
          role="button"
          tabIndex={0}
          onClick={() => !editing && setMenuOpen((v) => !v)}
          onKeyDown={(e) => {
            if (!editing && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setMenuOpen((v) => !v);
            }
          }}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`cursor-pointer rounded-2xl px-3.5 py-2.5 text-left text-sm leading-relaxed shadow-e1
                      transition-colors ${
                        mine
                          ? 'rounded-br-md border border-accent/25 bg-accent/12 text-text hover:bg-accent/[0.18]'
                          : 'rounded-bl-md border border-border bg-bg-card text-text hover:bg-white/[0.05]'
                      }`}
        >
          {message.forwarded && (
            <p className="mb-1 flex items-center gap-1 text-[10px] italic text-text-dim">
              <Forward size={10} /> Forwarded
            </p>
          )}

          {message.reply_to && (
            <button
              onClick={(e) => { e.stopPropagation(); onJumpTo?.(message.reply_to!.id); }}
              className="mb-1.5 block w-full rounded-lg border-l-2 border-accent bg-black/15 px-2 py-1.5 text-left"
            >
              <span className="block text-[10px] font-semibold text-accent">
                {message.reply_to.sender === 'admin' ? 'Support' : 'Member'}
              </span>
              <span className="line-clamp-2 block text-[11px] text-text-muted">
                {message.reply_to.body}
              </span>
            </button>
          )}

          {editing ? (
            <div onClick={(e) => e.stopPropagation()}>
              <textarea
                value={draft}
                autoFocus
                rows={2}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    saveEdit();
                  }
                  if (e.key === 'Escape') { setDraft(message.body); setEditing(false); }
                }}
                className="input w-full min-w-[200px] resize-y py-1.5 text-sm"
              />
              <div className="mt-1.5 flex justify-end gap-1.5">
                <button
                  onClick={() => { setDraft(message.body); setEditing(false); }}
                  className="rounded px-2 py-1 text-[11px] text-text-muted hover:text-text"
                >
                  Cancel
                </button>
                <button onClick={saveEdit} className="btn-primary px-2.5 py-1 text-[11px]">
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p id={`msg-${message.id}`} className="whitespace-pre-wrap break-words">
              {message.body}
            </p>
          )}
        </div>

        {/* Reactions hang off the bottom edge, overlapping the bubble the way
            every chat app draws them. */}
        {counts.length > 0 && (
          <div className={`-mt-1.5 flex flex-wrap gap-1 ${mine ? 'justify-end pr-2' : 'pl-2'}`}>
            {counts.map(([emoji, n]) => (
              <button
                key={emoji}
                onClick={() => onReact?.(message.id, emoji)}
                title={message.my_reaction === emoji ? 'Remove your reaction' : 'React'}
                className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] shadow-e1
                            transition ${
                              message.my_reaction === emoji
                                ? 'border-accent/50 bg-accent/20'
                                : 'border-border bg-bg-elevated hover:border-accent/40'
                            }`}
              >
                <span>{emoji}</span>
                {n > 1 && <span className="text-text-muted">{n}</span>}
              </button>
            ))}
          </div>
        )}

        {menuOpen && !editing && (
          <div
            role="menu"
            className={`panel absolute z-30 mt-1 animate-fade-up overflow-hidden rounded-xl p-1 text-sm ${
              pickerOpen ? 'w-[min(88vw,320px)]' : 'w-52'
            } ${
              mine ? 'right-0' : 'left-0'
            }`}
          >
            {/* The emoji row sits at the top, as it does on a phone. */}
            {onReact && (
              <div className="flex items-center justify-between gap-0.5 border-b border-white/[0.07] px-1 pb-1.5 pt-1">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => act(() => onReact(message.id, emoji))}
                    aria-label={`React ${emoji}`}
                    className={`grid h-7 w-7 place-items-center rounded-full text-base transition
                                hover:scale-125 ${message.my_reaction === emoji ? 'bg-accent/25' : ''}`}
                  >
                    {emoji}
                  </button>
                ))}
                {/* Six is what fits on the row; everything else is one tap
                    further in, which is where every other chat app puts it. */}
                <button
                  onClick={() => setPickerOpen((v) => !v)}
                  aria-label="More emoji"
                  aria-expanded={pickerOpen}
                  className={`grid h-7 w-7 place-items-center rounded-full transition
                              hover:bg-white/[0.08] ${pickerOpen ? 'bg-accent/25 text-accent' : 'text-text-muted'}`}
                >
                  <SmilePlus size={15} />
                </button>
              </div>
            )}

            {pickerOpen && onReact && (
              <div className="px-1 py-1.5">
                <EmojiPicker
                  className="!w-full !border-0 !bg-transparent !shadow-none"
                  onPick={(emoji) => {
                    onReact(message.id, emoji);
                    setPickerOpen(false);
                    setMenuOpen(false);
                  }}
                />
              </div>
            )}

            {onReply && (
              <MenuItem icon={<CornerUpLeft size={14} />} label="Reply"
                        onClick={() => act(() => onReply(message))} />
            )}
            {onForward && (
              <MenuItem icon={<Forward size={14} />} label="Forward"
                        onClick={() => act(() => onForward(message))} />
            )}
            <MenuItem
              icon={copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              label={copied ? 'Copied' : 'Copy'}
              onClick={copy}
            />
            {onStar && (
              <MenuItem
                icon={<Star size={14} className={message.starred ? 'fill-accent text-accent' : ''} />}
                label={message.starred ? 'Unstar' : 'Star'}
                onClick={() => act(() => onStar(message.id))}
              />
            )}
            {message.can_edit && onEdit && (
              <MenuItem icon={<Pencil size={14} />} label="Edit"
                        onClick={() => act(() => { setDraft(message.body); setEditing(true); })} />
            )}
            {canDelete && onDelete && (
              <MenuItem icon={<Trash2 size={14} />} label="Delete" tone="danger"
                        onClick={() => act(() => onDelete(message.id))} />
            )}
            <MenuItem icon={<X size={14} />} label="Close" onClick={() => setMenuOpen(false)} />
          </div>
        )}
      </div>

      <div className={`flex items-center gap-2 text-[10px] text-text-dim ${mine ? 'flex-row-reverse' : ''}`}>
        <span>{dateTime(message.created_at)}</span>
        {message.edited_at && <span className="italic">edited</span>}
        {message.starred && <Star size={10} className="fill-accent text-accent" />}
        {message.sender === 'admin' && message.author_name && (
          <span className="text-accent">{message.author_name}</span>
        )}
      </div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'danger';
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition ${
        tone === 'danger'
          ? 'text-danger hover:bg-danger/10'
          : 'text-text-muted hover:bg-white/[0.06] hover:text-text'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
