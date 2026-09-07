import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive, Ban, CheckCircle2, KeyRound, MinusCircle, MoreVertical, PencilLine,
  PlusCircle, Search, ShieldCheck, Users as UsersIcon,
} from 'lucide-react';

import NetworkTree from '@/components/NetworkTree';
import { Alert, ConfirmDialog, EmptyState, Modal, StatCard, StatusBadge } from '@/components/ui';
import { dateTime, money, shortDate } from '@/lib/format';
import {
  adminAdjustBalance, adminSetBalance, adminSetPassword, downlineTree, getUsers,
  memberDetail, pendingKyc, setUserStatus, subscribe,
} from '@/lib/store';
import type { User, UserStatus } from '@/lib/types';

type Action = 'add' | 'take' | 'set' | 'password' | null;

/**
 * Every member, what they are worth, and what the desk can do about it.
 *
 * The row actions are the point of the screen: somebody handed cash over the
 * counter and it has to reach a wallet, or an account has to be closed. They
 * all sit one menu behind the member, so nothing destructive is under a stray
 * click, and every money action writes a ledger row the member can see on
 * their own statement.
 */
export default function AdminUsers() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [target, setTarget] = useState<User | null>(null);
  const [closing, setClosing] = useState<User | null>(null);
  const [message, setMessage] = useState('');
  const [, tick] = useState(0);

  useEffect(() => subscribe(() => tick((n) => n + 1)), []);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuFor]);

  const users = getUsers().filter((u) => !u.is_staff);
  const kycQueue = pendingKyc();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
        u.referral_code.toLowerCase().includes(q),
    );
  }, [users, query]);

  function open(kind: Action, user: User) {
    setTarget(user);
    setAction(kind);
    setMenuFor(null);
  }

  function changeStatus(user: User, status: UserStatus, note: string) {
    try {
      setUserStatus(user.id, status);
      setMessage(note);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not update that account.');
    }
    setMenuFor(null);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-3d sm:text-3xl">Users &amp; network</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every member, their balances, and the tree beneath them.
        </p>
      </header>

      {message && (
        <div className="mt-5">
          <Alert kind="success" onDismiss={() => setMessage('')}>{message}</Alert>
        </div>
      )}

      {kycQueue.length > 0 && (
        <div className="mt-6">
          <Alert kind="warn">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} />
              {kycQueue.length} identity {kycQueue.length === 1 ? 'document is' : 'documents are'} awaiting review.{' '}
              <Link to="/admin/kyc" className="font-medium underline">Open the KYC desk</Link>
            </span>
          </Alert>
        </div>
      )}

      <div className="relative mt-6">
        <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email or referral code"
          className="input pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No members match" icon={<UsersIcon size={26} />} />
        </div>
      ) : (
        <div className="table-wrap mt-4">
          <table className="data">
            <thead>
              <tr>
                <th>Member</th>
                <th>Code</th>
                <th>Sponsor</th>
                <th className="text-right">Wallet</th>
                <th className="text-right">Invested</th>
                <th>KYC</th>
                <th>Joined</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const sponsor = users.find((x) => x.id === u.sponsor_id);
                return (
                  <tr key={u.id} className={u.status !== 'active' ? 'opacity-60' : undefined}>
                    <td
                      onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                      className="cursor-pointer"
                    >
                      <p className="flex items-center gap-2 font-medium">
                        {`${u.first_name} ${u.last_name}`.trim() || u.email}
                        {u.status !== 'active' && <StatusBadge status={u.status} />}
                      </p>
                      <p className="text-xs text-text-muted">{u.email}</p>
                    </td>
                    <td className="font-mono text-xs text-accent">{u.referral_code}</td>
                    <td className="text-xs text-text-muted">
                      {sponsor ? `${sponsor.first_name} ${sponsor.last_name}`.trim() : '—'}
                    </td>
                    <td className="text-right tabular-nums text-success">{money(u.wallet_balance)}</td>
                    <td className="text-right tabular-nums text-accent">{money(u.invested_balance)}</td>
                    <td><StatusBadge status={u.kyc_status} /></td>
                    <td className="text-text-muted">{shortDate(u.created_at)}</td>
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
                                  onClick={() => open('add', u)} />
                            <Item icon={<MinusCircle size={14} />} label="Take funds out"
                                  onClick={() => open('take', u)} />
                            <Item icon={<PencilLine size={14} />} label="Set balance"
                                  onClick={() => open('set', u)} />
                            <Item icon={<KeyRound size={14} />} label="Change password"
                                  onClick={() => open('password', u)} />
                            <div className="my-1 border-t border-white/[0.07]" />
                            {u.status === 'blocked' ? (
                              <Item icon={<CheckCircle2 size={14} />} label="Unblock account"
                                    onClick={() => changeStatus(u, 'active', 'Account unblocked.')} />
                            ) : (
                              <Item icon={<Ban size={14} />} label="Block account" tone="danger"
                                    onClick={() => changeStatus(u, 'blocked', 'Account blocked.')} />
                            )}
                            {u.status === 'archived' ? (
                              <Item icon={<CheckCircle2 size={14} />} label="Reopen account"
                                    onClick={() => changeStatus(u, 'active', 'Account reopened.')} />
                            ) : (
                              <Item icon={<Archive size={14} />} label="Close account" tone="danger"
                                    onClick={() => { setClosing(u); setMenuFor(null); }} />
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {expanded && <MemberDetail userId={expanded} />}

      <MoneyDialog
        action={action}
        user={target}
        onClose={() => setAction(null)}
        onDone={(note) => { setAction(null); setMessage(note); }}
      />

      <ConfirmDialog
        open={Boolean(closing)}
        title="Close this account?"
        body={
          closing
            ? `${(`${closing.first_name} ${closing.last_name}`.trim() || closing.email)} can no longer sign in `
              + 'and drops out of this list. Their deposits, payouts and the commission they earned for their '
              + 'sponsor stay in the books — closing is reversible, deleting the ledger would not be.'
            : ''
        }
        confirmLabel="Close account"
        onConfirm={() => closing && changeStatus(closing, 'archived', 'Account closed.')}
        onClose={() => setClosing(null)}
      />
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
 * store call they end in — one component rather than four near-copies that
 * would drift apart the first time the wording changed.
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
      hint: 'The difference is worked out from the balance as it stands, so anything credited in the meantime is not overwritten.',
      label: 'New balance',
    },
    password: {
      title: 'Change password',
      hint: 'The member is not told the new password — you will have to give it to them.',
      label: 'New password',
    },
  }[action];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      if (action === 'password') {
        adminSetPassword(user!.id, value);
        onDone('Password changed.');
        return;
      }
      const amount = Number(value);
      if (!Number.isFinite(amount)) throw new Error('Enter a number.');
      if (!note.trim()) throw new Error('Give a reason — the member sees it on their statement.');
      if (action === 'add') adminAdjustBalance(user!.id, Math.abs(amount), note.trim());
      if (action === 'take') adminAdjustBalance(user!.id, -Math.abs(amount), note.trim());
      if (action === 'set') adminSetBalance(user!.id, amount, note.trim());
      onDone(
        action === 'set'
          ? `Balance set to ${money(amount)}.`
          : `${money(Math.abs(amount))} ${action === 'add' ? 'added' : 'removed'}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  return (
    <Modal open title={COPY.title} onClose={onClose} width="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert kind="error">{error}</Alert>}

        <div className="rounded-xl border border-border bg-white/[0.03] px-3 py-2.5 text-sm">
          <p className="font-medium">{`${user.first_name} ${user.last_name}`.trim() || user.email}</p>
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
          <button type="submit" className="btn-primary">{COPY.title}</button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Everything the desk holds on one member.
 *
 * This is what opening a row used to be missing: the table says what somebody
 * is worth and nothing else, so the questions that follow — where the money
 * came from, what is still pending, who sits under them — meant a trip to four
 * other screens.
 */
function MemberDetail({ userId }: { userId: string }) {
  const detail = memberDetail(userId);
  if (!detail) return null;

  const { user, sponsor, network } = detail;
  const nodes = downlineTree(userId, 10);

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
        {`${user.first_name} ${user.last_name}`.trim() || user.email}
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Wallet" value={money(user.wallet_balance)} tone="success" />
        <StatCard label="Active principal" value={money(user.invested_balance)} tone="accent"
                  hint={`${detail.active_investments} active`} />
        <StatCard label="Deposited" value={money(detail.deposited)}
                  hint={detail.pending_deposits ? `${detail.pending_deposits} pending` : 'all verified'} />
        <StatCard label="Earned" value={money(detail.roi_earned + detail.commission_earned)} tone="gold"
                  hint={`${money(detail.roi_earned)} returns · ${money(detail.commission_earned)} commission`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-sm font-semibold">Account</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Email" value={user.email} />
            <Row label="Phone" value={user.phone || '—'} />
            <Row label="Location" value={[user.city, user.state, user.country].filter(Boolean).join(', ') || '—'} />
            <Row label="Referral code" value={user.referral_code} mono />
            <Row label="Sponsor" value={sponsor ? `${sponsor.first_name} ${sponsor.last_name}`.trim() : '—'} />
            <Row label="Status" value={user.status} />
            <Row label="KYC" value={user.kyc_status} />
            <Row label="Withdrawn" value={money(detail.withdrawn)} />
            <Row label="Pending withdrawals" value={String(detail.pending_withdrawals)} />
            <Row label="Support messages" value={String(detail.messages)} />
          </dl>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold">Network</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Direct referrals" value={String(network.direct)} />
            <Row label="Total downline" value={String(network.total)} />
            <Row label="Team business" value={money(network.team_business)} />
            <Row label="Commission earned" value={money(network.earned)} />
          </dl>

          <h3 className="mt-5 text-sm font-semibold">Recent movements</h3>
          {detail.recent.length === 0 ? (
            <p className="mt-2 text-sm text-text-dim">Nothing yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-xs">
              {detail.recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 border-b border-border pb-1.5">
                  <span className="min-w-0">
                    <span className="block truncate text-text-muted">{t.note}</span>
                    <span className="text-text-dim">{dateTime(t.created_at)}</span>
                  </span>
                  <span className={`shrink-0 tabular-nums ${t.amount < 0 ? 'text-danger' : 'text-success'}`}>
                    {money(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-text-muted">
        Network beneath them
      </h3>
      <div className="mt-3">
        {nodes.length ? (
          <NetworkTree nodes={nodes} />
        ) : (
          <EmptyState title="Nobody below this member yet" icon={<UsersIcon size={26} />} />
        )}
      </div>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-1.5">
      <dt className="text-text-dim">{label}</dt>
      <dd className={`text-right ${mono ? 'font-mono text-accent' : 'text-text'}`}>{value}</dd>
    </div>
  );
}
