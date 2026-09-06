'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Mail, MapPin, Phone, User } from 'lucide-react';

import { money, shortDate } from '@/lib/api';
import type { TreeNode } from '@/types';
import { StatusBadge } from './ui';

const LEVEL_ACCENTS = [
  'border-l-accent',
  'border-l-gold',
  'border-l-success',
  'border-l-purple-500',
  'border-l-pink-500',
];

/**
 * The downline tree.
 *
 * Depth is expressed with an indent plus a coloured left rule per level rather
 * than nested boxes — at six or seven levels deep, nested borders eat the whole
 * width and the rows stop being readable.
 */
export default function NetworkTree({ nodes }: { nodes: TreeNode[] }) {
  if (!nodes.length) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <p className="font-medium">Your network is empty</p>
        <p className="mt-1 text-sm text-text-muted">
          Share your referral link — anyone who joins with it appears here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <TreeRow key={node.user_id} node={node} depth={0} />
      ))}
    </div>
  );
}

function TreeRow({ node, depth }: { node: TreeNode; depth: number }) {
  // Only the first two levels start expanded — a large network would otherwise
  // render thousands of rows on first paint.
  const [open, setOpen] = useState(depth < 1);
  const [detail, setDetail] = useState(false);
  const children = node.children ?? [];
  const accent = LEVEL_ACCENTS[depth % LEVEL_ACCENTS.length];

  return (
    <div>
      <div
        className={`rounded-lg border border-border border-l-2 bg-bg-card transition hover:bg-bg-elevated ${accent}`}
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          {children.length > 0 ? (
            <button
              onClick={() => setOpen((v) => !v)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded text-text-muted hover:bg-bg hover:text-text"
              aria-label={open ? 'Collapse' : 'Expand'}
              aria-expanded={open}
            >
              {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          ) : (
            <span className="grid h-6 w-6 shrink-0 place-items-center text-text-dim">
              <User size={12} />
            </span>
          )}

          <button
            onClick={() => setDetail((v) => !v)}
            className="min-w-0 flex-1 text-left"
            aria-expanded={detail}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-sm font-medium text-text">{node.name}</span>
              <span className="font-mono text-[11px] text-accent">{node.referral_code}</span>
              <span className="badge bg-bg-elevated text-[10px] text-text-muted">L{node.level}</span>
              {children.length > 0 && (
                <span className="text-[11px] text-text-dim">
                  {node.direct_referrals} direct
                </span>
              )}
            </div>
            <p className="truncate text-xs text-text-muted">{node.email}</p>
          </button>

          <div className="hidden shrink-0 text-right sm:block">
            <p className="text-[10px] uppercase tracking-wide text-text-dim">Business</p>
            <p className="text-sm tabular-nums text-text">{money(node.total_deposited)}</p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-[10px] uppercase tracking-wide text-text-dim">Paid you</p>
            <p className="text-sm font-semibold tabular-nums text-success">
              {money(node.commission_to_root)}
            </p>
          </div>
        </div>

        {detail && (
          <div className="grid gap-3 border-t border-border px-3 py-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <Detail icon={<Mail size={12} />} label="Email" value={node.email} />
            <Detail icon={<Phone size={12} />} label="Phone" value={node.phone || '—'} />
            <Detail icon={<MapPin size={12} />} label="Country" value={node.country || '—'} />
            <Detail label="Joined" value={shortDate(node.joined_at)} />
            <Detail label="Active principal" value={money(node.invested_balance)} />
            <Detail label="Returns earned" value={money(node.total_roi_earned)} />
            <Detail label="Total deposited" value={money(node.total_deposited)} />
            <div>
              <p className="text-text-dim">Status</p>
              <div className="mt-1 flex gap-1.5">
                <StatusBadge status={node.status} />
                <StatusBadge status={node.kyc_status} />
              </div>
            </div>
          </div>
        )}
      </div>

      {open && children.length > 0 && (
        <div className="mt-1 space-y-1">
          {children.map((child) => (
            <TreeRow key={child.user_id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1 text-text-dim">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 truncate text-text">{value}</p>
    </div>
  );
}
