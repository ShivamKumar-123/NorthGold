/** Domain types. Mirrors the Django models the production app is built on,
 *  minus anything that only exists to satisfy a database. */

export type KycStatus = 'unverified' | 'pending' | 'approved' | 'rejected';

/** `archived` is closed, not erased: sign-in is refused and the account drops
 *  out of the member list, but its deposits, payouts and the commission it
 *  generated for its upline stay in the books. Deleting the row outright would
 *  take somebody else's earnings with it. */
export type UserStatus = 'active' | 'blocked' | 'archived';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type TxKind =
  | 'deposit'
  | 'withdrawal'
  | 'investment'
  | 'roi_payout'
  | 'commission'
  | 'principal_return'
  | 'withdrawal_hold'
  | 'withdrawal_refund'
  /** A manual correction by the desk. Signed, and always carrying a reason. */
  | 'adjustment';

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
  status: UserStatus;
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

/**
 * One deposit slab and what the sponsor earns in each month of the term.
 *
 * Deliberately the same shape as `RoiPlan`: two matrices edited side by side,
 * and an administrator who has understood one has understood the other. Every
 * percentage is theirs to set — nothing here is derived from the ROI rates.
 */
export type ReferralPlan = {
  id: string;
  name: string;
  description: string;
  min_amount: number;
  /** `null` on the open-ended top slab. */
  max_amount: number | null;
  tenure_months: number;
  display_order: number;
  /** One percent per month, index 0 = month 1. */
  months: number[];
  is_active: boolean;
};

export type Commission = {
  id: string;
  earner_id: string;
  from_user_id: string;
  /** The investment being paid on. Together with the month it identifies the
   *  payment, which is what stops a re-run paying the same month twice. */
  investment_id: string;
  /** Which month of the referral's investment this paid for. */
  month_index: number;
  /** The amount the percentage was applied to — a payment is unauditable
   *  without it, since the rate alone does not say what it was a rate OF. */
  base_amount: number;
  percent: number;
  amount: number;
  /** Set when the payment was skipped, with the reason. */
  skipped_reason: string | null;
  created_at: string;
};

/** Which identity document the ID pages are. `doc_type` says it is the front
 *  of an ID; this says the ID is an Aadhaar. A reviewer needs both — the
 *  number format and what can be checked against it differ per document. */
export type ProofType = 'aadhaar' | 'pan' | 'national_id';

export type KycDoc = {
  id: string;
  user_id: string;
  doc_type: string;
  /** Empty on documents where the question does not arise, such as a selfie. */
  proof_type: ProofType | '';
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
  referral_enabled: boolean;
};

/**
 * One message in a support thread.
 *
 * There is no conversation record: a thread IS every message carrying the same
 * `user_id`, which is what makes "one thread per member" true by construction.
 * `sender` says which side of the desk it came from; `author_name` says who
 * actually typed it, which differs only on an administrator's reply.
 */
export type SupportMessage = {
  id: string;
  user_id: string;
  sender: 'user' | 'admin';
  author_name: string;
  body: string;
  read_at: string | null;
  created_at: string;
  /** The message this one quotes, by id. Resolved when the bubble is drawn so
   *  an edited original shows its current text, as every chat app does. */
  reply_to: string | null;
  /** emoji -> the ids that picked it. One list per emoji rather than a row per
   *  reaction: a thread has two participants and the whole map is read every
   *  time a bubble is drawn. */
  reactions: Record<string, string[]>;
  /** Who starred it. A list rather than a flag: the member and the desk star
   *  for different reasons and must not clear each other's mark. */
  starred_by: string[];
  edited_at: string | null;
  forwarded: boolean;
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
  referral_plans: ReferralPlan[];
  commissions: Commission[];
  kyc: KycDoc[];
  messages: SupportMessage[];
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
