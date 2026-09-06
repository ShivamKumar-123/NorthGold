'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, MapPin, Phone, Users, X } from 'lucide-react';

import { money, num, shortDate } from '@/lib/api';
import type { MlmLevel, TreeNode } from '@/types';
import { StatusBadge } from './ui';

/* ── Layout constants ─────────────────────────────────────────────────────
   Spacing is fixed rather than fitted to the viewport: a network with forty
   members should scroll horizontally at a readable size, not shrink until the
   labels are unreadable. */
const LEAF_GAP = 118;      // minimum readable column width
const LEAF_GAP_MAX = 210;  // stop a two-person network spreading absurdly wide
const LEVEL_H = 122;
const PAD_LEFT = 78; // room for the level rail
const PAD_RIGHT = 30;
const PAD_TOP = 52;
const PAD_BOTTOM = 68;
const ROOT_R = 24;
const NODE_R = 15;

// Level 1 is a direct referral; everything deeper is indirect. Colours cycle
// so a deep network never runs out.
// Bright Gold -> Premium Gold -> Bronze -> Deep Gold -> Silver. A single
// warm ramp: each level reads as one step further from the light.
const LEVEL_COLORS = ['#FFFFFF', '#F5C34A', '#D9A62E', '#B87333', '#A87516', '#E8E8E5'];
const colorFor = (depth: number) =>
  depth === 0 ? LEVEL_COLORS[0] : LEVEL_COLORS[1 + ((depth - 1) % (LEVEL_COLORS.length - 1))];

type Positioned = {
  id: string;
  node: TreeNode | null; // null == the viewer ("YOU")
  depth: number;
  x: number;
  y: number;
  children: Positioned[];
  /** Children that exist but sit past the depth cap. */
  hidden: number;
};

/**
 * Assigns coordinates with a simplified Reingold–Tilford pass: leaves take the
 * next horizontal slot, and every parent is centred over the span of its
 * children. One post-order walk, no overlap.
 */
function layout(roots: TreeNode[], maxDepth: number, gap: number) {
  let cursor = 0;

  const place = (node: TreeNode, depth: number): Positioned => {
    const canDescend = depth < maxDepth;
    const kids = canDescend ? node.children ?? [] : [];

    const placed: Positioned = {
      id: node.user_id,
      node,
      depth,
      x: 0,
      y: depth * LEVEL_H,
      children: kids.map((child) => place(child, depth + 1)),
      // Children can be missing for two different reasons: this component
      // capped the depth, or the API already truncated the branch (the
      // dashboard requests ?depth=2). `direct_referrals` is present either
      // way, so it is the only reliable count of what is not being drawn.
      hidden: canDescend ? 0 : (node.children?.length || node.direct_referrals || 0),
    };

    if (placed.children.length === 0) {
      placed.x = cursor * gap;
      cursor += 1;
    } else {
      const first = placed.children[0].x;
      const last = placed.children[placed.children.length - 1].x;
      placed.x = (first + last) / 2;
    }
    return placed;
  };

  const children = roots.map((root) => place(root, 1));

  const root: Positioned = {
    id: 'root',
    node: null,
    depth: 0,
    x: children.length
      ? (children[0].x + children[children.length - 1].x) / 2
      : 0,
    y: 0,
    children,
    hidden: 0,
  };

  // `cursor` counts leaf slots; a tree of one node still needs one column.
  const columns = Math.max(cursor, 1);
  return { root, columns };
}

function flatten(node: Positioned, out: Positioned[] = []) {
  out.push(node);
  node.children.forEach((child) => flatten(child, out));
  return out;
}

export default function NetworkGraph({
  nodes,
  levels = [],
  rootName = 'You',
  maxDepth = 4,
}: {
  nodes: TreeNode[];
  levels?: MlmLevel[];
  rootName?: string;
  maxDepth?: number;
}) {
  const [selected, setSelected] = useState<TreeNode | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [available, setAvailable] = useState(0);

  // A three-person network in a 1100px card looks lost at the minimum column
  // width, so the columns stretch to fill whatever room there is — up to a
  // cap, beyond which the tree would read as scattered rather than connected.
  useEffect(() => {
    const node = scrollRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) =>
      setAvailable(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const { root, columns, all, width, height, depth, gap } = useMemo(() => {
    // Lay out once to learn the column count, then again at the width that
    // actually fits — the count cannot be known before the first pass.
    const probe = layout(nodes, maxDepth, LEAF_GAP);
    const room = Math.max(available - PAD_LEFT - PAD_RIGHT, 0);
    const g = probe.columns > 0 && room > 0
      ? Math.min(Math.max(room / probe.columns, LEAF_GAP), LEAF_GAP_MAX)
      : LEAF_GAP;
    const { root: r, columns: c } = layout(nodes, maxDepth, g);
    const list = flatten(r);
    const deepest = list.reduce((m, n) => Math.max(m, n.depth), 0);
    return {
      root: r,
      columns: c,
      all: list,
      width: PAD_LEFT + (c - 1) * g + PAD_RIGHT + g,
      height: PAD_TOP + deepest * LEVEL_H + PAD_BOTTOM,
      depth: deepest,
      gap: g,
    };
  }, [nodes, maxDepth, available]);

  if (!nodes.length) {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full border-2 border-dashed border-border text-text-dim">
          <Users size={20} />
        </span>
        <p className="font-medium text-text">Your network is empty</p>
        <p className="max-w-sm text-sm text-text-muted">
          Share your referral link — everyone who joins with it appears here,
          and so does everyone they bring.
        </p>
      </div>
    );
  }

  const x = (n: Positioned) => PAD_LEFT + n.x + gap / 2;
  const y = (n: Positioned) => PAD_TOP + n.y;

  const isDimmed = (n: Positioned) =>
    hovered !== null && n.id !== hovered && !isAncestorOf(root, hovered, n.id);

  return (
    <div className="space-y-4">
      <div className="card tex-network on-dark relative overflow-hidden p-2">
        <div className="grid-overlay opacity-50" aria-hidden />

        {/* Fixed spacing + horizontal scroll: shrinking a wide network to fit
            makes every label unreadable. */}
        <div ref={scrollRef} className="relative overflow-x-auto">
          {/* Rendered at natural size and centred, NOT stretched to the
              container: stretching scales the whole viewBox, which drags the
              level rail away from the left edge and into the middle of the
              card. Wider networks overflow into the scroll container instead. */}
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            className="mx-auto block"
            role="img"
            aria-label={`Referral network: ${all.length - 1} members across ${depth} levels below you.`}
          >
            <defs>
              <radialGradient id="ng-root-glow">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
              {LEVEL_COLORS.map((c, i) => (
                <radialGradient key={i} id={`ng-glow-${i}`}>
                  <stop offset="0%" stopColor={c} stopOpacity="0.45" />
                  <stop offset="100%" stopColor={c} stopOpacity="0" />
                </radialGradient>
              ))}
            </defs>

            {/* ── Level rails ────────────────────────────────────────── */}
            {Array.from({ length: depth }, (_, i) => i + 1).map((lvl) => {
              const config = levels.find((l) => l.level === lvl);
              const ly = PAD_TOP + lvl * LEVEL_H;
              return (
                <g key={`rail-${lvl}`}>
                  <line
                    x1={PAD_LEFT - 26}
                    y1={ly}
                    x2={width - PAD_RIGHT}
                    y2={ly}
                    stroke={colorFor(lvl)}
                    strokeOpacity="0.07"
                    strokeDasharray="2 6"
                  />
                  <text x={10} y={ly - 6} fontSize="10" fill="#6E6E69" letterSpacing="1.2">
                    L{lvl}
                  </text>
                  {config && (
                    <text x={10} y={ly + 8} fontSize="11" fontWeight="600" fill={colorFor(lvl)}>
                      {num(config.roi_percent, 1)}%
                    </text>
                  )}
                </g>
              );
            })}

            {/* ── Connectors ─────────────────────────────────────────────
                The flowing dash runs child → parent, which is the direction
                commission actually travels. */}
            {all.map((parent) =>
              parent.children.map((child) => {
                const px = x(parent);
                const py = y(parent);
                const cx = x(child);
                const cy = y(child);
                const mid = (py + cy) / 2;
                const dim = isDimmed(child);
                return (
                  <path
                    key={`${parent.id}-${child.id}`}
                    d={`M ${px} ${py + (parent.depth === 0 ? ROOT_R : NODE_R)}
                        C ${px} ${mid}, ${cx} ${mid}, ${cx} ${cy - NODE_R}`}
                    fill="none"
                    stroke={colorFor(child.depth)}
                    strokeWidth={1.6}
                    strokeOpacity={dim ? 0.1 : 0.55}
                    strokeDasharray="4 4"
                    className="animate-dash-flow [transition:stroke-opacity_250ms]"
                  />
                );
              }),
            )}

            {/* ── Nodes ──────────────────────────────────────────────── */}
            {all.map((n) => {
              const nx = x(n);
              const ny = y(n);
              const isRoot = n.depth === 0;
              const color = colorFor(n.depth);
              const dim = isDimmed(n);
              const label = isRoot ? rootName : n.node!.name;
              const initial = (label || '?').charAt(0).toUpperCase();

              return (
                <g
                  key={n.id}
                  opacity={dim ? 0.25 : 1}
                  className="cursor-pointer [transition:opacity_250ms]"
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(n.node)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelected(n.node);
                    }
                  }}
                >
                  <circle
                    cx={nx}
                    cy={ny}
                    r={isRoot ? 48 : 30}
                    fill={`url(#${isRoot ? 'ng-root-glow' : `ng-glow-${1 + ((n.depth - 1) % 5)}`})`}
                  />
                  <circle
                    cx={nx}
                    cy={ny}
                    r={isRoot ? ROOT_R : NODE_R}
                    fill={isRoot ? '#ffffff' : '#111110'}
                    stroke={color}
                    strokeWidth={isRoot ? 0 : 2.2}
                  />
                  <text
                    x={nx}
                    y={ny + (isRoot ? 4 : 4)}
                    textAnchor="middle"
                    fontSize={isRoot ? 11 : 11}
                    fontWeight="700"
                    fill={isRoot ? '#080808' : color}
                  >
                    {isRoot ? 'YOU' : initial}
                  </text>

                  {/* Name + what this branch has paid the viewer. */}
                  {!isRoot && (
                    <>
                      <text
                        x={nx}
                        y={ny + NODE_R + 17}
                        textAnchor="middle"
                        fontSize="11"
                        fill="#E8E8E5"
                      >
                        {truncate(n.node!.name, 13)}
                      </text>
                      <text
                        x={nx}
                        y={ny + NODE_R + 31}
                        textAnchor="middle"
                        fontSize="10.5"
                        fontWeight="600"
                        fill="#22c55e"
                      >
                        {money(n.node!.commission_to_root).replace('.00', '')}
                      </text>
                      {n.hidden > 0 && (
                        <text
                          x={nx}
                          y={ny + NODE_R + 45}
                          textAnchor="middle"
                          fontSize="9.5"
                          fill="#6E6E69"
                        >
                          +{n.hidden} below
                        </text>
                      )}
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <p className="px-3 pb-2 pt-1 text-center text-[11px] text-text-dim">
          Hover to trace a branch · click a member for their details
          {columns > 7 && ' · scroll sideways to see the full network'}
        </p>
      </div>

      {selected && <MemberCard node={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/** True when `targetId` sits on the path from the root down to `nodeId`. */
function isAncestorOf(root: Positioned, hoveredId: string, nodeId: string): boolean {
  let found = false;
  const walk = (n: Positioned, chain: string[]) => {
    const next = [...chain, n.id];
    if (n.id === hoveredId && next.includes(nodeId)) found = true;
    n.children.forEach((c) => walk(c, next));
  };
  walk(root, []);
  return found;
}

function truncate(value: string, max: number) {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function MemberCard({ node, onClose }: { node: TreeNode; onClose: () => void }) {
  return (
    <div className="panel animate-fade-up relative rounded-2xl p-5">
      <button
        onClick={onClose}
        className="absolute right-3 top-3 rounded-lg p-1.5 text-text-muted transition hover:bg-white/5 hover:text-text"
        aria-label="Close"
      >
        <X size={16} />
      </button>

      <div className="flex flex-wrap items-start gap-4">
        <span
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-base font-bold shadow-e2"
          style={{
            border: `2px solid ${colorFor(node.level)}`,
            color: colorFor(node.level),
            background: '#111110',
          }}
        >
          {node.name.charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-text">{node.name}</p>
            <span className="badge bg-white/5 text-text-muted">Level {node.level}</span>
            <span className="font-mono text-[11px] text-accent">{node.referral_code}</span>
            <StatusBadge status={node.status} />
          </div>

          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <Mail size={11} /> {node.email}
            </span>
            {node.phone && (
              <span className="flex items-center gap-1.5">
                <Phone size={11} /> {node.phone}
              </span>
            )}
            {node.country && (
              <span className="flex items-center gap-1.5">
                <MapPin size={11} /> {node.country}
              </span>
            )}
            <span>Joined {shortDate(node.joined_at)}</span>
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Paid you" value={money(node.commission_to_root)} tone="text-success" />
        <Metric label="Total deposited" value={money(node.total_deposited)} />
        <Metric label="Active principal" value={money(node.invested_balance)} tone="text-accent" />
        <Metric label="Direct referrals" value={String(node.direct_referrals)} />
      </dl>
    </div>
  );
}

function Metric({ label, value, tone = 'text-text' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-white/[0.02] p-3">
      <dt className="text-[10px] uppercase tracking-[0.12em] text-text-dim">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}
