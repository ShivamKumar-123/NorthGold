/** Domain types. Mirrors the Django models the production app is built on,
 *  minus anything that only exists to satisfy a database. */

export type KycStatus = 'unverified' | 'pending' | 'approved' | 'rejected';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type TxKind =
  | 'deposit'
  | 'withdrawal'
  | 'investment'
  | 'roi_payout'
  | 'commission'
  | 'principal_return'
  | 'withdrawal_hold'
  | 'withdrawal_refund';

export type User = {
  id: string;
  email: string;
  /** Demo only. A real build never stores a password client-side — see the
   *  note at the top of store.ts. */
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  address: string;
  is_staff: boolean;
  kyc_status: KycStatus;
  referral_code: string;
  /** The user who introduced them. `null` for a root account. */
  sponsor_id: string | null;
  tree_depth: number;
  wallet_balance: number;
  invested_balance: number;
  created_at: string;
};

export type RoiPlan = {
  id: string;
  name: string;
  description: string;
  min_amount: number;
  /** `null` means open-ended — the top tier has no cap. */
  max_amount: number | null;
  tenure_months: number;
  display_order: number;
  /** One percentage per month of the term, in order. */
  months: number[];
  is_active: boolean;
};

/** The plan as it was the moment the money went in. Copied onto the
 *  investment so a later plan edit can never change what was promised. */
export type PlanSnapshot = {
  name: string;
  tenure_months: number;
  months: number[];
};

export type Investment = {
  id: string;
  user_id: string;
  plan_id: string;
  plan_snapshot: PlanSnapshot;
  amount: number;
  start_date: string;
  maturity_date: string;
  months_paid: number;
  total_returned: number;
  status: 'active' | 'matured';
  created_at: string;
};

export type RoiPayout = {
  id: string;
  investment_id: string;
  user_id: string;
  month_index: number;
  percent: number;
  amount: number;
  paid_at: string;
};

export type Deposit = {
  id: string;
  user_id: string;
  amount: number;
  method: 'cash';
  reference: string;
  user_message: string;
  status: RequestStatus;
  admin_note: string;
  created_at: string;
  reviewed_at: string | null;
};

export type Withdrawal = {
  id: string;
  user_id: string;
  amount: number;
  method: 'cash';
  user_message: string;
  status: RequestStatus;
  admin_note: string;
  created_at: string;
  reviewed_at: string | null;
};

export type Transaction = {
  id: string;
  user_id: string;
  kind: TxKind;
  amount: number;
  /** Signed: what the wallet balance actually did. */
  balance_after: number;
  note: string;
  created_at: string;
};

export type MlmLevel = {
  level: number;
  label: string;
  deposit_percent: number;
  roi_percent: number;
  min_directs: number;
};

export type Commission = {
  id: string;
  earner_id: string;
  from_user_id: string;
  level: number;
  trigger: 'deposit' | 'roi';
  /** The amount the percentage was applied to — a payment is unauditable
   *  without it, since the rate alone does not say what it was a rate OF. */
  base_amount: number;
  percent: number;
  amount: number;
  /** Set when the payment was skipped, with the reason. */
  skipped_reason: string | null;
  created_at: string;
};

export type KycDoc = {
  id: string;
  user_id: string;
  doc_type: string;
  /** The file NAME only. Storing the bytes as base64 would fill localStorage
   *  after a handful of uploads, and there is no server here to hold them. */
  file_name: string;
  status: RequestStatus;
  rejection_reason: string;
  reviewed_at: string | null;
  created_at: string;
};

export type Issuer = { id: string; name: string; short_name: string; country: string };

export type Instrument = {
  id: string;
  symbol: string;
  name: string;
  issuer_name: string;
  category_label: string;
  interest_rate: number;
  tenure_months: number;
  min_investment: number;
  currency: string;
  current_price: number;
  change_percent: number;
  price_source: 'manual' | 'feed';
  is_featured: boolean;
};

export type Settings = {
  platform_name: string;
  support_email: string;
  support_phone: string;
  support_whatsapp: string;
  support_hours: string;
  support_address: string;
  deposit_min_amount: number;
  withdrawal_min_amount: number;
  auto_invest_on_deposit: boolean;
  mlm_deposit_enabled: boolean;
  mlm_roi_enabled: boolean;
  mlm_max_levels: number;
};

export type DB = {
  version: number;
  users: User[];
  plans: RoiPlan[];
  investments: Investment[];
  payouts: RoiPayout[];
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  transactions: Transaction[];
  levels: MlmLevel[];
  commissions: Commission[];
  kyc: KycDoc[];
  issuers: Issuer[];
  instruments: Instrument[];
  settings: Settings;
};

/** A node in the referral tree, carrying everything the graph draws in its
 *  detail panel — so selecting a member needs no second lookup. */
export type TreeNode = {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  referral_code: string;
  status: 'active' | 'suspended' | 'blocked';
  level: number;
  joined_at: string;
  invested_balance: number;
  total_deposited: number;
  /** Commission this member has generated for whoever the tree is rooted at. */
  commission_to_root: number;
  total_roi_earned: number;
  kyc_status: KycStatus;
  direct_referrals: number;
  children: TreeNode[];
};

/* ── View shapes ──────────────────────────────────────────────────────────
   A couple of components were written against the REST payloads. Rather than
   rewrite them, the pages hand them these — the same fields, derived from the
   store. */

export type Projection = {
  plan: string;
  principal: number;
  tenure_months: number;
  total_return: number;
  total_return_percent: number;
  returns_principal: boolean;
  schedule: Array<{ month: number; percent: number; payout: number; cumulative: number }>;
};

/** The headline number a plan card shows: what the whole term pays. */
export function totalReturnPercent(plan: RoiPlan): number {
  return plan.months.reduce((sum, p) => sum + p, 0);
}
