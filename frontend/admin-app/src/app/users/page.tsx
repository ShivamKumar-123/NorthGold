'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Search, Users } from 'lucide-react';

import { Alert, EmptyState, PageLoader, StatusBadge } from '@/components/ui';
import { ApiError, api, money, shortDate } from '@/lib/api';
import { useRequireAdmin } from '@/lib/auth';
import type { Paginated, User } from '@/types';

export default function UsersPage() {
  const { admin, loading: authLoading } = useRequireAdmin();

  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '25' });
      if (query.trim()) params.set('q', query.trim());
      if (status) params.set('status', status);
      const res = await api.get<Paginated<User>>(`/auth/admin/users/?${params}`);
      setUsers(res.items);
      setTotal(res.total);
      setPages(res.pages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load users.');
    } finally {
      setLoading(false);
    }
  }, [page, query, status]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    if (!admin) return;
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [admin, load]);

  if (authLoading || (loading && !users.length && !query)) return <PageLoader label="Loading users" />;
  if (!admin) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold">Users &amp; network</h1>
        <p className="mt-1 text-sm text-text-muted">
          Open any member to see their downline tree, investments and commission history.
        </p>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
            className="input pl-9"
            placeholder="Search by email, name, phone or referral code"
            aria-label="Search users"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="input w-auto"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      <p className="mt-4 text-xs text-text-dim">
        {total} member{total === 1 ? '' : 's'}
        {query && ` matching “${query}”`}
      </p>

      <div className="mt-4">
        {users.length === 0 ? (
          <EmptyState
            title="No members found"
            description={query ? 'Try a different search.' : 'Nobody has registered yet.'}
            icon={<Users size={26} />}
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Code</th>
                  <th>Sponsor</th>
                  <th className="text-right">Directs</th>
                  <th className="text-right">Deposited</th>
                  <th className="text-right">Invested</th>
                  <th className="text-right">Wallet</th>
                  <th>Joined</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/users/${u.id}`} className="font-medium text-accent hover:underline">
                        {u.name}
                      </Link>
                      <p className="text-xs text-text-muted">{u.email}</p>
                    </td>
                    <td className="font-mono text-xs text-accent">{u.referral_code}</td>
                    <td className="text-xs text-text-muted">
                      {u.sponsor ? (
                        <Link href={`/users/${u.sponsor.id}`} className="hover:text-accent hover:underline">
                          {u.sponsor.name}
                        </Link>
                      ) : (
                        <span className="text-text-dim">—</span>
                      )}
                    </td>
                    <td className="text-right tabular-nums">{u.direct_referral_count}</td>
                    <td className="text-right tabular-nums">{money(u.total_deposited)}</td>
                    <td className="text-right tabular-nums text-accent">{money(u.invested_balance)}</td>
                    <td className="text-right tabular-nums text-success">{money(u.wallet_balance)}</td>
                    <td className="text-text-muted">{shortDate(u.created_at)}</td>
                    <td>
                      <StatusBadge status={u.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="btn-ghost"
          >
            Previous
          </button>
          <span className="text-sm text-text-muted">Page {page} of {pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="btn-ghost"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
