'use client';

import { useState } from 'react';

import { num } from '@/lib/api';
import type { MlmLevel } from '@/types';

type Node = { id: string; x: number; y: number; level: number };

// A deliberately small, legible tree: you, three directs, and their referrals.
// Enough to show that level 2 is "your referral's referral" without turning
// into an unreadable hairball.
const NODES: Node[] = [
  { id: 'you', x: 300, y: 40, level: 0 },

  { id: 'a', x: 130, y: 150, level: 1 },
  { id: 'b', x: 300, y: 150, level: 1 },
  { id: 'c', x: 470, y: 150, level: 1 },

  { id: 'a1', x: 60, y: 260, level: 2 },
  { id: 'a2', x: 190, y: 260, level: 2 },
  { id: 'b1', x: 300, y: 260, level: 2 },
  { id: 'c1', x: 410, y: 260, level: 2 },
  { id: 'c2', x: 540, y: 260, level: 2 },

  { id: 'a1x', x: 60, y: 360, level: 3 },
  { id: 'b1x', x: 300, y: 360, level: 3 },
  { id: 'c2x', x: 540, y: 360, level: 3 },
];

const EDGES: [string, string][] = [
  ['you', 'a'], ['you', 'b'], ['you', 'c'],
  ['a', 'a1'], ['a', 'a2'], ['b', 'b1'], ['c', 'c1'], ['c', 'c2'],
  ['a1', 'a1x'], ['b1', 'b1x'], ['c2', 'c2x'],
];

// One warm ramp, light to dark: each level reads as a step further from
// the light. Two levels sharing a colour makes the diagram unreadable.
const LEVEL_COLOR: Record<number, string> = {
  0: '#FFFFFF',
  1: '#F5C34A',
  2: '#D9A62E',
  3: '#B87333',
};

const LEVEL_LABEL: Record<number, string> = {
  0: 'You',
  1: 'Direct referrals',
  2: 'Their referrals',
  3: 'And theirs',
};

const byId = (id: string) => NODES.find((n) => n.id === id)!;

/**
 * Visual explanation of the referral structure.
 *
 * Hovering a level dims the others — the point being made is that money flows
 * UP from every tier, not just from people you personally introduced.
 */
export default function NetworkDiagram({ levels }: { levels: MlmLevel[] }) {
  const [active, setActive] = useState<number | null>(null);

  const rateFor = (level: number) => levels.find((l) => l.level === level);
  const dim = (level: number) => active !== null && active !== level && level !== 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
      {/* Diagram */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-bg-sunken/60 p-4">
        <div className="grid-overlay opacity-60" aria-hidden />
        <svg
          viewBox="0 0 600 410"
          className="relative w-full"
          role="img"
          aria-label="A referral network: you at the top, your direct referrals below, and their referrals below that."
        >
          <defs>
            <radialGradient id="node-glow">
              <stop offset="0%" stopColor="#D9A62E" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#D9A62E" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Edges. The flowing dash runs from child toward parent, which is the
              direction the commission actually travels. */}
          {EDGES.map(([from, to]) => {
            const a = byId(from);
            const b = byId(to);
            const faded = dim(b.level);
            return (
              <path
                key={`${from}-${to}`}
                d={`M ${a.x} ${a.y} C ${a.x} ${(a.y + b.y) / 2}, ${b.x} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`}
                fill="none"
                stroke={LEVEL_COLOR[b.level]}
                strokeWidth={1.5}
                strokeOpacity={faded ? 0.12 : 0.5}
                strokeDasharray="4 4"
                className="animate-dash-flow [transition:stroke-opacity_300ms]"
              />
            );
          })}

          {/* Nodes */}
          {NODES.map((node) => {
            const isRoot = node.level === 0;
            const faded = dim(node.level);
            const color = LEVEL_COLOR[node.level];

            return (
              <g
                key={node.id}
                opacity={faded ? 0.25 : 1}
                className="[transition:opacity_300ms]"
                onMouseEnter={() => setActive(node.level)}
                onMouseLeave={() => setActive(null)}
              >
                {isRoot && <circle cx={node.x} cy={node.y} r={44} fill="url(#node-glow)" />}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isRoot ? 20 : 12}
                  fill={isRoot ? color : '#111110'}
                  stroke={color}
                  strokeWidth={isRoot ? 0 : 2}
                />
                {isRoot && (
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fontSize="11"
                    fontWeight="700"
                    fill="#05070d"
                  >
                    YOU
                  </text>
                )}
              </g>
            );
          })}

          {/* Level rails */}
          {[1, 2, 3].map((level) => {
            const y = { 1: 150, 2: 260, 3: 360 }[level as 1 | 2 | 3];
            const rate = rateFor(level);
            return (
              <g
                key={level}
                opacity={dim(level) ? 0.3 : 1}
                className="[transition:opacity_300ms]"
                onMouseEnter={() => setActive(level)}
                onMouseLeave={() => setActive(null)}
              >
                <text x={8} y={y - 20} fontSize="10" fill="#5e6b82" letterSpacing="1.4">
                  {`L${level}`.toUpperCase()}
                </text>
                {rate && (
                  <text x={8} y={y - 7} fontSize="11" fontWeight="600" fill={LEVEL_COLOR[level]}>
                    {num(rate.roi_percent, 1)}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map((level) => {
          const rate = rateFor(level);
          const isRoot = level === 0;

          return (
            <div
              key={level}
              onMouseEnter={() => setActive(isRoot ? null : level)}
              onMouseLeave={() => setActive(null)}
              className={`flex items-center gap-4 rounded-xl border p-4 transition-all duration-300 ${
                active === level
                  ? 'border-accent/50 bg-white/[0.04]'
                  : 'border-border bg-bg-card'
              }`}
            >
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold"
                style={{
                  background: isRoot ? LEVEL_COLOR[0] : 'transparent',
                  border: isRoot ? 'none' : `2px solid ${LEVEL_COLOR[level]}`,
                  color: isRoot ? '#05070d' : LEVEL_COLOR[level],
                }}
              >
                {isRoot ? 'YOU' : `L${level}`}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text">{LEVEL_LABEL[level]}</p>
                <p className="text-xs text-text-muted">
                  {isRoot
                    ? 'Everything below pays into your wallet'
                    : level === 1
                      ? 'People who signed up on your link'
                      : 'Indirect — you never met them, you still earn'}
                </p>
              </div>

              {rate && (
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums" style={{ color: LEVEL_COLOR[level] }}>
                    {num(rate.deposit_percent, 1)}%
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-text-dim">on deposit</p>
                </div>
              )}
            </div>
          );
        })}

        {levels.length > 3 && (
          <p className="pt-1 text-center text-xs text-text-dim">
            + {levels.length - 3} deeper level{levels.length - 3 === 1 ? '' : 's'} beyond this diagram
          </p>
        )}
      </div>
    </div>
  );
}
