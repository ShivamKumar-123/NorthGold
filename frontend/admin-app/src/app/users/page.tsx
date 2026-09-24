'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  Archive, Ban, CheckCircle2, KeyRound, MinusCircle, MoreVertical, PencilLine,
  PlusCircle, Search, Trash2, Users,
} from 'lucide-react';

import { Alert, EmptyState, Modal, PageLoader, StatusBadge } from '@/components/ui';
import { ApiError, api, money, shortDate } from '@/lib/api';
import { useRequireAdmin } from '@/lib/auth';
import type { Paginated, User } from '@/types';

type Action = 'add' | 'take' | 'set' | 'password' | null;

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
  const [notice, setNotice] = useState('');
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [target, setTarget] = useState<User | null>(null);
  const [closing, setClosing] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<User | null>(null);

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

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuFor]);

  const openAction = (kind: Action, user: User) => {
    setTarget(user);
    setAction(kind);
    setMenuFor(null);
  };

  const changeStatus = async (user: User, next: string, note: string) => {
    setMenuFor(null);
    setError('');
    try {
      await api.patch(`/auth/admin/users/${user.id}/`, { status: next });
      setNotice(note);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update that account.');
    }
  };

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
      {notice && <div className="mt-5"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

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
                  <th className="text-right">Actions</th>
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
                    <td className="text-right">
                      <div className="relative inline-block" onMouseDown={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setMenuFor(menuFor === u.id ? null : u.id)}
                          aria-label={`Actions for ${u.email}`}
                          aria-expanded={menuFor === u.id}
                          className="rounded-lg border border-border p-1.5 text-text-muted transition
                                     hover:border-accent/45 hover:text-text"
                        >
                          <MoreVertical size={15} />
                        </button>

                        {menuFor === u.id && (
                          <div
                            role="menu"
                            className="panel absolute right-0 z-40 mt-1 w-56 animate-fade-up overflow-hidden
                                       rounded-xl p-1 text-left"
                          >
                            <Item icon={<PlusCircle size={14} />} label="Add funds"
                                  onClick={() => openAction('add', u)} />
                            <Item icon={<MinusCircle size={14} />} label="Take funds out"
                                  onClick={() => openAction('take', u)} />
                            <Item icon={<PencilLine size={14} />} label="Set balance"
                                  onClick={() => openAction('set', u)} />
                            <Item icon={<KeyRound size={14} />} label="Change password"
                                  onClick={() => openAction('password', u)} />
                            <div className="my-1 border-t border-white/[0.07]" />
                            {u.status === 'blocked' ? (
                              <Item icon={<CheckCircle2 size={14} />} label="Unblock account"
                                    onClick={() => void changeStatus(u, 'active', 'Account unblocked.')} />
                            ) : (
                              <Item icon={<Ban size={14} />} label="Block account" tone="danger"
                                    onClick={() => void changeStatus(u, 'blocked', 'Account blocked.')} />
                            )}
                            {u.status === 'archived' ? (
                              <Item icon={<CheckCircle2 size={14} />} label="Reopen account"
                                    onClick={() => void changeStatus(u, 'active', 'Account reopened.')} />
                            ) : (
                              <Item icon={<Archive size={14} />} label="Close account" tone="danger"
                                    onClick={() => { setClosing(u); setMenuFor(null); }} />
                            )}
                            <div className="my-1 border-t border-white/[0.07]" />
                            <Item icon={<Trash2 size={14} />} label="Delete permanently" tone="danger"
                                  onClick={() => { setDeleting(u); setMenuFor(null); }} />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MoneyDialog
        action={action}
        user={target}
        onClose={() => setAction(null)}
        onDone={(note) => { setAction(null); setNotice(note); void load(); }}
      />

      <DeleteDialog
        user={deleting}
        onClose={() => setDeleting(null)}
        onDone={(note) => { setDeleting(null); setNotice(note); void load(); }}
        onError={(msg) => { setDeleting(null); setError(msg); }}
      />

      <Modal
        open={Boolean(closing)}
        title="Close this account?"
        onClose={() => setClosing(null)}
        width="max-w-md"
        footer={
          <>
            <button onClick={() => setClosing(null)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
            <button
              onClick={() => {
                const user = closing;
                setClosing(null);
                if (user) void changeStatus(user, 'archived', 'Account closed.');
              }}
              className="btn-danger px-4 py-2 text-sm"
            >
              Close account
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-text-muted">
          {closing?.name} can no longer sign in and drops out of this list. Their
          deposits, payouts and the commission they earned for their sponsor stay
          in the books — closing is reversible, deleting the ledger would not be.
        </p>
      </Modal>

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


function Item({
  icon, label, onClick, tone,
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

/**
 * The money and password dialogs, which differ only in their copy and which
 * endpoint they end in — one component rather than four near-copies that would
 * drift apart the first time the wording changed.
 *
 * "Set balance" posts the destination rather than a difference worked out in
 * the browser: the API computes the delta under a row lock, so a payout landing
 * between reading the screen and pressing the button is not overwritten.
 */
function MoneyDialog({
  action,
  user,
  onClose,
  onDone,
}: {
  action: Action;
  user: User | null;
  onClose: () => void;
  onDone: (note: string) => void;
}) {
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue('');
    setNote('');
    setError('');
  }, [action, user]);

  if (!action || !user) return null;

  const COPY = {
    add: {
      title: 'Add funds',
      hint: 'Credited to the wallet immediately and shown on their statement.',
      label: 'Amount to add',
    },
    take: {
      title: 'Take funds out',
      hint: 'Debited from the wallet immediately. It cannot go below zero.',
      label: 'Amount to remove',
    },
    set: {
      title: 'Set balance',
      hint: 'The difference is worked out on the server, so anything credited in the meantime is not overwritten.',
      label: 'New balance',
    },
    password: {
      title: 'Change password',
      hint: 'The member is not told the new password — you will have to give it to them.',
      label: 'New password',
    },
  }[action];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (action === 'password') {
        await api.post(`/auth/admin/users/${user!.id}/password/`, { new_password: value });
        onDone('Password changed.');
        return;
      }
      const amount = Number(value);
      if (!Number.isFinite(amount)) {
        setError('Enter a number.');
        return;
      }
      if (!note.trim()) {
        setError('Give a reason — the member sees it on their statement.');
        return;
      }

      const body = action === 'set'
        ? { set_to: amount, description: note.trim() }
        : { amount: action === 'take' ? -Math.abs(amount) : Math.abs(amount), description: note.trim() };
      await api.post(`/wallet/admin/users/${user!.id}/adjust/`, body);

      onDone(
        action === 'set'
          ? `Balance set to ${money(amount)}.`
          : `${money(Math.abs(amount))} ${action === 'add' ? 'added' : 'removed'}.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That did not work.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open title={COPY.title} onClose={onClose} width="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert kind="error">{error}</Alert>}

        <div className="rounded-xl border border-border bg-white/[0.03] px-3 py-2.5 text-sm">
          <p className="font-medium">{user.name}</p>
          <p className="text-xs text-text-muted">
            {user.email} · wallet {money(user.wallet_balance)}
          </p>
        </div>

        <p className="text-xs leading-relaxed text-text-muted">{COPY.hint}</p>

        <div>
          <label className="label" htmlFor="value">{COPY.label}</label>
          <input
            id="value"
            type={action === 'password' ? 'text' : 'number'}
            step={action === 'password' ? undefined : '0.01'}
            min={action === 'password' ? undefined : 0}
            required
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="input"
            placeholder={action === 'password' ? 'At least 8 characters' : '0.00'}
          />
        </div>

        {action !== 'password' && (
          <div>
            <label className="label" htmlFor="note">Reason <span className="text-danger">*</span></label>
            <input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input"
              placeholder="Cash handed over at the counter"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Working…' : COPY.title}
          </button>
        </div>
      </form>
    </Modal>
  );
}


/**
 * Deleting an account for good.
 *
 * Typing the email is the point. Every other action on this menu is one click
 * because every other action can be undone; this one cannot, and the row it is
 * pointed at is whichever one the mouse happened to be over. Making somebody
 * spell out the address is the cheapest way to be sure they meant that member
 * and not the one above.
 */
function DeleteDialog({
  user,
  onClose,
  onDone,
  onError,
}: {
  user: User | null;
  onClose: () => void;
  onDone: (note: string) => void;
  onError: (message: string) => void;
}) {
  const [typed, setTyped] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setTyped('');
  }, [user]);

  if (!user) return null;

  const matches = typed.trim().toLowerCase() === user.email.toLowerCase();

  async function confirm() {
    if (!matches || working) return;
    setWorking(true);
    try {
      await api.del(`/auth/admin/users/${user!.id}/`);
      onDone(`${user!.email} and all of their data were deleted.`);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Could not delete that account.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal open title="Delete this account permanently?" onClose={onClose} width="max-w-md">
      <p className="text-sm leading-relaxed text-text-muted">
        Everything below is removed and cannot be recovered.
      </p>

      <ul className="mt-3 space-y-1 rounded-xl border border-danger/25 bg-danger/[0.06] p-3 text-xs text-text-muted">
        <li>Wallet {money(user.wallet_balance)} · principal {money(user.invested_balance)}</li>
        <li>Every transaction, deposit and withdrawal</li>
        <li>Every investment and the payouts made against it</li>
        <li>Identity documents and support messages</li>
        <li>Commission they earned, and the commission they generated for their sponsor</li>
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-text-dim">
        The {user.direct_referral_count} member
        {user.direct_referral_count === 1 ? '' : 's'} they introduced keep their
        accounts and lose their sponsor. Closing the account instead keeps every
        record and can be undone.
      </p>

      <div className="mt-4">
        <label className="label" htmlFor="confirm-email">
          Type <span className="font-mono text-accent">{user.email}</span> to confirm
        </label>
        <input
          id="confirm-email"
          value={typed}
          autoFocus
          onChange={(e) => setTyped(e.target.value)}
          className="input"
        />
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btn-ghost">Cancel</button>
        <button
          onClick={() => void confirm()}
          disabled={!matches || working}
          className="btn-danger disabled:opacity-40"
        >
          {working ? 'Deleting…' : 'Delete permanently'}
        </button>
      </div>
    </Modal>
  );
}
