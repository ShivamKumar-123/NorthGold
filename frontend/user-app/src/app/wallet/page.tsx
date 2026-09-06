'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, Banknote, Receipt,
} from 'lucide-react';

import BankCard from '@/components/BankCard';
import { Alert, EmptyState, Modal, PageLoader, StatusBadge } from '@/components/ui';
import { ApiError, api, dateTime, money } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/lib/auth';
import type {
  Deposit, Paginated, PaymentChannel, PaymentMethod, Transaction, WalletSummary, Withdrawal,
} from '@/types';

// Cash is the only settlement route on this platform: every movement is handed
// over in person and confirmed by an administrator against the member's own
// description of the handover. The backend still models bank, UPI and crypto,
// so those flows can be switched back on by restoring this list — but nothing
// in the product offers them.
const CASH_METHOD: PaymentMethod = 'cash';

type Tab = 'deposits' | 'withdrawals' | 'transactions';

export default function WalletPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { refreshUser } = useAuth();

  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [channels, setChannels] = useState<PaymentChannel[]>([]);
  const [tab, setTab] = useState<Tab>('deposits');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, depRes, wdRes, txRes, chRes] = await Promise.all([
        api.get<WalletSummary>('/wallet/summary/'),
        api.get<Paginated<Deposit>>('/wallet/deposits/?per_page=50'),
        api.get<Paginated<Withdrawal>>('/wallet/withdrawals/?per_page=50'),
        api.get<Paginated<Transaction>>('/wallet/transactions/?per_page=100'),
        api.get<PaymentChannel[]>('/wallet/channels/'),
      ]);
      setSummary(summaryRes);
      setDeposits(depRes.items);
      setWithdrawals(wdRes.items);
      setTransactions(txRes.items);
      setChannels(chRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your wallet.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function afterSubmit(message: string) {
    setNotice(message);
    setDepositOpen(false);
    setWithdrawOpen(false);
    await Promise.all([load(), refreshUser()]);
  }

  if (authLoading || (loading && !summary)) return <PageLoader label="Loading your wallet" />;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Wallet</h1>
          <p className="mt-1 text-sm text-text-muted">
            Deposit, withdraw, and see every movement on your account.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setDepositOpen(true)} className="btn-primary">
            <ArrowDownToLine size={15} /> Deposit
          </button>
          <button onClick={() => setWithdrawOpen(true)} className="btn-ghost">
            <ArrowUpFromLine size={15} /> Withdraw
          </button>
        </div>
      </header>

      {error && <div className="mt-5"><Alert kind="error" onDismiss={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-5"><Alert kind="success" onDismiss={() => setNotice('')}>{notice}</Alert></div>}

      {/* The wallet figures are dealt as payment cards — this is the money
          screen, and a row of flat stat tiles read like a spreadsheet. */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <BankCard
          label="Available balance"
          value={money(summary?.wallet_balance)}
          hint="Ready to invest or withdraw"
          tone="success"
          tag="0001"
        />
        <BankCard
          label="Locked in investments"
          value={money(summary?.invested_balance)}
          hint="Earning monthly returns"
          tone="accent"
          tag="0002"
        />
        <BankCard
          label="Pending deposits"
          value={money(summary?.pending_deposit_amount)}
          hint={`${summary?.pending_deposit_count ?? 0} awaiting verification`}
          tag="0003"
        />
        <BankCard
          label="Pending withdrawals"
          value={money(summary?.pending_withdrawal_amount)}
          hint={`${summary?.pending_withdrawal_count ?? 0} on hold`}
          tag="0004"
        />
      </div>

      <div className="mt-8 flex gap-1 border-b border-border">
        {([
          ['deposits', `Deposits (${deposits.length})`],
          ['withdrawals', `Withdrawals (${withdrawals.length})`],
          ['transactions', 'All transactions'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition ${
              tab === key ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'deposits' && (
          deposits.length === 0 ? (
            <EmptyState
              title="No deposits yet"
              description="Make your first deposit to start earning monthly returns."
              icon={<ArrowDownToLine size={26} />}
              action={<button onClick={() => setDepositOpen(true)} className="btn-primary">Deposit now</button>}
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th className="text-right">Amount</th>
                    <th>Reference</th>
                    <th>Your message</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d) => (
                    <tr key={d.id}>
                      <td className="text-text-muted">{dateTime(d.created_at)}</td>
                      <td>{d.method_label}</td>
                      <td className="text-right font-medium tabular-nums">{money(d.amount, d.currency)}</td>
                      <td className="font-mono text-xs text-text-muted">{d.reference_no || '—'}</td>
                      <td className="max-w-[280px] whitespace-normal text-xs text-text-muted">
                        {d.user_message || '—'}
                      </td>
                      <td>
                        <StatusBadge status={d.status} />
                        {d.rejection_reason && (
                          <p className="mt-1 max-w-[220px] whitespace-normal text-xs text-danger">
                            {d.rejection_reason}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'withdrawals' && (
          withdrawals.length === 0 ? (
            <EmptyState title="No withdrawals yet" icon={<ArrowUpFromLine size={26} />} />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th className="text-right">Requested</th>
                    <th className="text-right">Fee</th>
                    <th className="text-right">You receive</th>
                    <th>Reference</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td className="text-text-muted">{dateTime(w.created_at)}</td>
                      <td>{w.method_label}</td>
                      <td className="text-right tabular-nums">{money(w.amount, w.currency)}</td>
                      <td className="text-right tabular-nums text-text-muted">{money(w.fee, w.currency)}</td>
                      <td className="text-right font-medium tabular-nums">{money(w.net_amount, w.currency)}</td>
                      <td className="font-mono text-xs text-text-muted">{w.payout_reference || '—'}</td>
                      <td>
                        <StatusBadge status={w.status} />
                        {w.rejection_reason && (
                          <p className="mt-1 max-w-[220px] whitespace-normal text-xs text-danger">
                            {w.rejection_reason}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'transactions' && (
          transactions.length === 0 ? (
            <EmptyState title="No transactions yet" icon={<Receipt size={26} />} />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => {
                    const value = Number(t.amount);
                    return (
                      <tr key={t.id}>
                        <td className="text-text-muted">{dateTime(t.created_at)}</td>
                        <td>
                          <span className="badge bg-bg-elevated text-text-muted">{t.tx_type_label}</span>
                        </td>
                        <td className="max-w-[340px] whitespace-normal text-text-muted">{t.description}</td>
                        <td
                          className={`text-right font-medium tabular-nums ${
                            value >= 0 ? 'text-success' : 'text-danger'
                          }`}
                        >
                          {value >= 0 ? '+' : ''}
                          {money(t.amount)}
                        </td>
                        <td className="text-right tabular-nums text-text-muted">{money(t.balance_after)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        channels={channels}
        onDone={afterSubmit}
      />
      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        available={summary?.wallet_balance ?? 0}
        onDone={afterSubmit}
      />
    </div>
  );
}

// ─── Deposit ──────────────────────────────────────────────────────────────

function DepositModal({
  open,
  onClose,
  channels,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  channels: PaymentChannel[];
  onDone: (message: string) => void;
}) {
  const method = CASH_METHOD;
  const [amount, setAmount] = useState('');
  const [channelId, setChannelId] = useState('');
  const [message, setMessage] = useState('');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const methodChannels = channels.filter((c) => c.channel_type === method);
  const selectedChannel = methodChannels.find((c) => c.id === channelId) ?? methodChannels[0];

  useEffect(() => {
    setChannelId(methodChannels[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, channels.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    // Mirrors the server rule so the user is told before the round-trip.
    if (!message.trim()) {
      setError('Describe the cash handover — who took it, where, and when.');
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('amount', amount);
      form.append('method', method);
      if (selectedChannel) form.append('channel_id', selectedChannel.id);
      if (message.trim()) form.append('user_message', message.trim());
      if (reference.trim()) form.append('reference_no', reference.trim());
      if (proof) form.append('proof', proof);

      await api.postForm<Deposit>('/wallet/deposits/', form);
      setAmount('');
      setMessage('');
      setReference('');
      setProof(null);
      onDone('Deposit request submitted. An administrator will verify it shortly.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit the deposit.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title="Make a deposit" onClose={onClose} width="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert kind="error">{error}</Alert>}

        <div className="flex items-start gap-3 rounded-xl border border-accent/35 bg-accent/[0.07] p-4">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-accent/40 bg-accent/15 text-accent">
            <Banknote size={17} />
          </span>
          <div>
            <p className="text-sm font-medium text-text">Cash deposit</p>
            <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
              Hand the cash over at the counter, collect a receipt, then describe
              the handover below so an administrator can verify it.
            </p>
          </div>
        </div>

        {methodChannels.length > 1 && (
          <div>
            <label className="label" htmlFor="channel">Send to</label>
            <select
              id="channel"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="input"
            >
              {methodChannels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {selectedChannel && <ChannelDetails channel={selectedChannel} />}

        <div>
          <label className="label" htmlFor="amount">Amount <span className="text-danger">*</span></label>
          <input
            id="amount"
            type="number"
            min={1}
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            placeholder="1000.00"
          />
          <p className="mt-1 text-xs text-text-dim">
            Your monthly rate depends on this amount — larger deposits enter a higher tier.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="message">
            Message to the verifier <span className="text-danger">*</span>
          </label>
          <textarea
            id="message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="input resize-none"
            placeholder="e.g. Handed $80,000 in cash to Rakesh at the Andheri branch on Tuesday 14th, receipt no. 4471."
          />
          <p className="mt-1 text-xs text-warn">
            A cash payment leaves no bank trail, so this message is what the
            administrator verifies against. Be specific.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="reference">Reference number</label>
            <input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="input"
              placeholder="Receipt no."
            />
          </div>
          <div>
            <label className="label" htmlFor="proof">Proof (screenshot / receipt)</label>
            <input
              id="proof"
              type="file"
              accept="image/*"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
              className="input file:mr-3 file:rounded file:border-0 file:bg-bg-elevated file:px-2 file:py-1 file:text-xs file:text-text"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Submitting…' : 'Submit for verification'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ChannelDetails({ channel }: { channel: PaymentChannel }) {
  const rows: [string, string][] = [];
  if (channel.channel_type === 'bank') {
    rows.push(['Account name', channel.account_name], ['Account number', channel.account_number],
              ['Bank', channel.bank_name], ['IFSC', channel.ifsc_code]);
  } else if (channel.channel_type === 'upi') {
    rows.push(['UPI ID', channel.upi_id]);
  } else if (channel.channel_type === 'crypto') {
    rows.push(['Address', channel.wallet_address], ['Network', channel.network]);
  } else {
    rows.push(['Contact', channel.contact_person], ['Phone', channel.contact_phone],
              ['Address', channel.office_address]);
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4 text-sm">
      <p className="font-medium">{channel.name}</p>
      <dl className="mt-2.5 space-y-1.5">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-text-muted">{k}</dt>
            <dd className="break-all text-right font-mono text-xs text-text">{v}</dd>
          </div>
        ))}
      </dl>
      {channel.instructions && (
        <p className="mt-3 border-t border-border pt-2.5 text-xs leading-relaxed text-text-muted">
          {channel.instructions}
        </p>
      )}
      {channel.qr_code && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={channel.qr_code} alt={`${channel.name} QR code`} className="mt-3 h-36 w-36 rounded bg-white p-1" />
      )}
    </div>
  );
}

// ─── Withdraw ─────────────────────────────────────────────────────────────

function WithdrawModal({
  open,
  onClose,
  available,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  available: number;
  onDone: (message: string) => void;
}) {
  const method = CASH_METHOD;
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (Number(amount) > available) {
      setError(`You only have ${money(available)} available.`);
      return;
    }
    if (!message.trim()) {
      setError('Tell us where and when you want to collect the cash.');
      return;
    }

    setSubmitting(true);
    try {
      // No payout details: a cash collection is arranged in the message, and
      // there is no account to pay it into.
      await api.post<Withdrawal>('/wallet/withdrawals/', {
        amount, method,
        user_message: message.trim(),
      });
      setAmount('');
      setMessage('');
      onDone('Withdrawal requested. The amount is on hold until an administrator approves it.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit the withdrawal.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} title="Request a withdrawal" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert kind="error">{error}</Alert>}

        <Alert kind="info">
          Available to withdraw: <strong>{money(available)}</strong>. The amount is
          held as soon as you request it, and returned if the request is rejected.
        </Alert>

        <div className="flex items-start gap-3 rounded-xl border border-accent/35 bg-accent/[0.07] p-4">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-accent/40 bg-accent/15 text-accent">
            <Banknote size={17} />
          </span>
          <div>
            <p className="text-sm font-medium text-text">Cash collection</p>
            <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
              Payouts are handed over in person at the counter. Say below when you
              plan to collect, and an administrator will confirm the slot.
            </p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="wd-amount">Amount <span className="text-danger">*</span></label>
          <input
            id="wd-amount"
            type="number"
            min={1}
            max={available}
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            placeholder="100.00"
          />
        </div>

        <div>
          <label className="label" htmlFor="wd-message">
            Collection details <span className="text-danger">*</span>
          </label>
          <textarea
            id="wd-message"
            rows={2}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="input resize-none"
            placeholder="e.g. I will collect from the head office counter on Friday afternoon."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting ? 'Submitting…' : 'Request withdrawal'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
