'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { EMOJI_GROUPS } from '@/lib/emoji';

/** One glyph per tab. Words would not fit, and the glyph is the thing being
 *  picked — a row of labels reads like a settings screen. */
const TAB_ICON: Record<string, string> = {
  Smileys: '😀',
  People: '🙌',
  Nature: '🐶',
  Food: '🍎',
  Activity: '⚽',
  Travel: '🚀',
  Objects: '💡',
  Symbols: '❤️',
  Flags: '🏳️',
};

const SEARCH_LIMIT = 120;

/**
 * The full emoji set, in a panel.
 *
 * Only the open group is rendered — around 250 buttons at worst rather than
 * the whole sixteen hundred, which is the difference between a panel that
 * opens instantly and one that stutters on a phone. Searching cuts across
 * every group and is capped, because nobody scans past the first screen of
 * results anyway.
 *
 * Positioning is the caller's job: this draws the panel, and whoever opens it
 * knows whether there is room below the bubble or only above it.
 */
export default function EmojiPicker({
  onPick,
  className = '',
}: {
  onPick: (emoji: string) => void;
  className?: string;
}) {
  const [group, setGroup] = useState(EMOJI_GROUPS[0]?.label ?? 'Smileys');
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return EMOJI_GROUPS.find((g) => g.label === group)?.items ?? [];
    }
    const hits = [];
    for (const g of EMOJI_GROUPS) {
      for (const item of g.items) {
        if (item.n.includes(q)) {
          hits.push(item);
          if (hits.length >= SEARCH_LIMIT) return hits;
        }
      }
    }
    return hits;
  }, [group, query]);

  return (
    <div className={`panel w-[min(88vw,320px)] overflow-hidden rounded-xl ${className}`}>
      <div className="relative border-b border-white/[0.07] p-2">
        <Search size={13} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-dim" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search emoji"
          aria-label="Search emoji"
          className="input py-1.5 pl-7 text-xs"
        />
      </div>

      {!query.trim() && (
        <div className="flex items-center gap-0.5 overflow-x-auto border-b border-white/[0.07] px-1.5 py-1">
          {EMOJI_GROUPS.map((g) => (
            <button
              key={g.label}
              onClick={() => setGroup(g.label)}
              title={g.label}
              aria-label={g.label}
              aria-pressed={group === g.label}
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm transition ${
                group === g.label ? 'bg-accent/20' : 'hover:bg-white/[0.06]'
              }`}
            >
              {TAB_ICON[g.label] ?? '•'}
            </button>
          ))}
        </div>
      )}

      <div className="grid max-h-56 grid-cols-8 gap-0.5 overflow-y-auto p-1.5">
        {shown.length === 0 ? (
          <p className="col-span-8 py-6 text-center text-xs text-text-dim">
            Nothing matches “{query.trim()}”.
          </p>
        ) : (
          shown.map((item) => (
            <button
              key={item.c}
              onClick={() => onPick(item.c)}
              title={item.n}
              aria-label={item.n}
              className="grid h-8 w-8 place-items-center rounded-lg text-lg transition
                         hover:scale-110 hover:bg-white/[0.08]"
            >
              {item.c}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
