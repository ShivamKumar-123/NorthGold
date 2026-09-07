import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShieldCheck, Users as UsersIcon } from 'lucide-react';

import NetworkTree from '@/components/NetworkTree';
import { Alert, EmptyState, StatusBadge } from '@/components/ui';
import { money, shortDate } from '@/lib/format';
import { downlineTree, getUsers, pendingKyc } from '@/lib/store';

export default function AdminUsers() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-3d sm:text-3xl">Users & network</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every member, their balances, and the tree beneath them.
        </p>
      </header>

      {kycQueue.length > 0 && (
        <div className="mt-6">
          {/* The queue itself lives on its own page now; this only says there
              is something waiting, so nobody has to go looking. */}
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
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const sponsor = users.find((x) => x.id === u.sponsor_id);
                return (
                  <tr
                    key={u.id}
                    onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                    className="cursor-pointer"
                  >
                    <td>
                      <p className="font-medium">
                        {`${u.first_name} ${u.last_name}`.trim() || u.email}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {expanded && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
            Network beneath{' '}
            {(() => {
              const u = users.find((x) => x.id === expanded);
              return u ? `${u.first_name} ${u.last_name}`.trim() || u.email : '';
            })()}
          </h2>
          {downlineTree(expanded, 10).length ? (
            <NetworkTree nodes={downlineTree(expanded, 10)} />
          ) : (
            <EmptyState title="Nobody below this member yet" icon={<UsersIcon size={26} />} />
          )}
        </section>
      )}
    </div>
  );
}
