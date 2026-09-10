import { money } from './format';
import * as store from './store';
import type { ReferralPlan, TreeNode } from './types';

/**
 * View-model layer.
 *
 * The screens were written against REST payloads. Rather than rewrite every
 * one of them, this assembles the same shapes out of the store — so the
 * markup, the field names and the empty states all carry over untouched, and
 * there is exactly one place to look when a screen and the data disagree.
 */

export type WalletSummaryView = {
  wallet_balance: number;
  invested_balance: number;
  pending_deposit_amount: number;
  pending_deposit_count: number;
  pending_withdrawal_amount: number;
  pending_withdrawal_count: number;
};

export type NextPayoutView = {
  investment_id: string;
  plan_name: string;
  month_index: number;
  due_at: string;
  percent: number;
  estimated_amount: number;
};

export type InvestmentView = {
  id: string;
  plan_name: string;
  principal: number;
  start_date: string;
  maturity_date: string;
  status: 'active' | 'matured';
  months_paid: number;
  tenure_months: number;
  total_roi_paid: number;
  next_payout: NextPayoutView | null;
  payouts: Array<{
    id: string;
    month_index: number;
    percent: number;
    amount: number;
    due_at: string;
    status: 'paid';
  }>;
};

export type InvestmentSummaryView = {
  active_count: number;
  active_principal: number;
  total_roi_received: number;
  matured_count: number;
  upcoming_payouts: NextPayoutView[];
  wallet_balance: number;
};

export type EarningsView = {
  total_earned: number;
  direct_earned: number;
  indirect_earned: number;
  network: {
    direct_count: number;
    total_downline: number;
    team_business: number;
    /** Members and business at each depth of the tree. */
    levels: Array<{ level: number; count: number; business: number; invested: number }>;
  };
  /** Commission actually earned at each level. */
  by_month: Array<{ month: number; total: number; payments: number }>;
  /** Who in the network has generated the most for this member. */
  top_producing_members: Array<{ user_id: string; name: string; email: string; total: number }>;
  structure: ReferralPlan[];
};

export type TransactionView = {
  id: string;
  amount: number;
  tx_type_label: string;
  note: string;
  balance_after: number;
  created_at: string;
};

const TX_LABELS: Record<string, string> = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  withdrawal_hold: 'Withdrawal hold',
  withdrawal_refund: 'Withdrawal returned',
  investment: 'Investment',
  roi_payout: 'ROI payout',
  commission: 'Referral commission',
  principal_return: 'Principal returned',
  adjustment: 'Administrator adjustment',
};

export function walletSummary(userId: string): WalletSummaryView {
  return store.walletSummary(userId);
}

export function investments(userId: string): InvestmentView[] {
  const payouts = store.payoutsFor(userId);
  return store.investmentsFor(userId).map((inv) => {
    const monthIndex = inv.months_paid + 1;
    const percent = inv.plan_snapshot.months[monthIndex - 1];
    return {
      id: inv.id,
      plan_name: inv.plan_snapshot.name,
      principal: inv.amount,
      start_date: inv.start_date,
      maturity_date: inv.maturity_date,
      status: inv.status,
      months_paid: inv.months_paid,
      tenure_months: inv.plan_snapshot.tenure_months,
      total_roi_paid: inv.total_returned,
      next_payout:
        inv.status === 'active' && percent !== undefined
          ? {
              investment_id: inv.id,
              plan_name: inv.plan_snapshot.name,
              month_index: monthIndex,
              due_at: store.addMonths(inv.start_date, monthIndex),
              percent,
              estimated_amount: Math.floor(((inv.amount * percent) / 100) * 100) / 100,
            }
          : null,
      payouts: payouts
        .filter((p) => p.investment_id === inv.id)
        .map((p) => ({
          id: p.id,
          month_index: p.month_index,
          percent: p.percent,
          amount: p.amount,
          due_at: p.paid_at,
          status: 'paid' as const,
        })),
    };
  });
}

export function investmentSummary(userId: string): InvestmentSummaryView {
  const list = investments(userId);
  const active = list.filter((i) => i.status === 'active');
  const wallet = store.walletSummary(userId);
  return {
    active_count: active.length,
    active_principal: round(active.reduce((s, i) => s + i.principal, 0)),
    total_roi_received: wallet.total_returned,
    matured_count: list.filter((i) => i.status === 'matured').length,
    upcoming_payouts: store.upcomingPayouts(userId).map((p) => ({
      investment_id: p.investment_id,
      plan_name: p.plan,
      month_index: p.month_index,
      due_at: p.due,
      percent: p.percent,
      estimated_amount: p.amount,
    })),
    wallet_balance: wallet.wallet_balance,
  };
}

export function earnings(userId: string): EarningsView {
  const summary = store.downlineSummary(userId);
  const commissions = store.commissionsFor(userId);
  const users = store.getUsers();

  const depths = [...new Set(summary.members.map((m) => m.level))].sort((a, b) => a - b);

  const perMember = new Map<string, number>();
  commissions.forEach((c) => {
    perMember.set(c.from_user_id, round((perMember.get(c.from_user_id) ?? 0) + c.amount));
  });

  return {
    total_earned: summary.earned,
    direct_earned: summary.from_direct,
    indirect_earned: summary.from_indirect,
    network: {
      direct_count: summary.direct,
      total_downline: summary.total,
      team_business: summary.team_business,
      levels: depths.map((level) => {
        const at = summary.members.filter((m) => m.level === level);
        return {
          level,
          count: at.length,
          business: round(at.reduce((s, m) => s + m.total_deposited, 0)),
          invested: round(at.reduce((s, m) => s + m.invested_balance, 0)),
        };
      }),
    },
    // Broken down by month rather than by level: with the chain gone, "which
    // month of the term paid this" is the split that still means something.
    by_month: [...new Set(commissions.map((c) => c.month_index))]
      .sort((a, b) => a - b)
      .map((month) => {
        const rows = commissions.filter((c) => c.month_index === month);
        return {
          month,
          total: round(rows.reduce((s, c) => s + c.amount, 0)),
          payments: rows.length,
        };
      }),
    top_producing_members: [...perMember.entries()]
      .map(([id, total]) => {
        const u = users.find((x) => x.id === id);
        return {
          user_id: id,
          name: u ? `${u.first_name} ${u.last_name}`.trim() || u.email : 'Unknown',
          email: u?.email ?? '',
          total,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
    structure: store.getReferralPlans(),
  };
}

export function tree(userId: string, depth = 5): TreeNode[] {
  return store.downlineTree(userId, depth);
}

export function transactions(userId: string, limit?: number): TransactionView[] {
  const rows = store.transactionsFor(userId).map((t) => ({
    id: t.id,
    amount: t.amount,
    tx_type_label: TX_LABELS[t.kind] ?? t.kind,
    note: t.note,
    balance_after: t.balance_after,
    created_at: t.created_at,
  }));
  return limit ? rows.slice(0, limit) : rows;
}

/** The commission ledger, with the counterparty resolved for display. */
export function commissionLog(userId: string) {
  const users = store.getUsers();
  return store.allCommissionsFor(userId).map((c) => {
    const from = users.find((u) => u.id === c.from_user_id);
    return {
      id: c.id,
      month_index: c.month_index,
      trigger_label: `Month ${c.month_index}`,
      base_amount: c.base_amount,
      percent: c.percent,
      amount: c.amount,
      status: c.skipped_reason ? ('skipped' as const) : ('paid' as const),
      skip_reason: c.skipped_reason,
      created_at: c.created_at,
      source_name: from ? `${from.first_name} ${from.last_name}`.trim() || from.email : 'Unknown',
      source_email: from?.email ?? '',
    };
  });
}

/** The shareable referral link for a code. Built from the live origin so it
 *  works on localhost, on a LAN address and on a deployed host alike. */
export function referralLink(code: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/register?ref=${code}`;
}

/** Used in a couple of empty states that quote the entry price. */
export function entryPointLabel(): string {
  const plans = store.getPlans();
  return money(plans.length ? Math.min(...plans.map((p) => p.min_amount)) : 0).replace('.00', '');
}

function round(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type PaymentChannelView = {
  id: string;
  name: string;
  channel_type: 'cash';
  contact_person: string;
  contact_phone: string;
  office_address: string;
  instructions: string;
  min_amount: number;
};

/**
 * The cash counter, presented as the single payment channel.
 *
 * The production build keeps a table of channels because it also settles by
 * bank, UPI and crypto. Cash is the only route here, so the "channel" is just
 * the desk details from settings — one source of truth, and the admin edits it
 * in the same place it is displayed from.
 */
export function cashChannel(): PaymentChannelView {
  const s = store.getSettings();
  return {
    id: 'channel-cash',
    name: 'Cash Collection — Head Office',
    channel_type: 'cash',
    contact_person: 'Accounts Desk',
    contact_phone: s.support_phone,
    office_address: s.support_address,
    instructions:
      'Hand the cash over at the counter, collect a receipt, then file a deposit request describing the handover.',
    min_amount: s.deposit_min_amount,
  };
}
