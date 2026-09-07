export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  first_name: string;
  last_name: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  address: string;
  avatar: string | null;
  role: 'user' | 'admin' | 'superadmin';
  /** 'archived' is closed, not erased: sign-in is refused and the account
   *  drops out of the member list, but its deposits, payouts and the
   *  commission it generated for its upline stay in the books. */
  status: 'active' | 'suspended' | 'blocked' | 'archived';
  kyc_status: 'pending' | 'submitted' | 'approved' | 'rejected';
  email_verified: boolean;
  referral_code: string;
  sponsor: { id: string; name: string; email: string; referral_code: string } | null;
  tree_depth: number;
  direct_referral_count: number;
  wallet_balance: string;
  invested_balance: string;
  total_roi_earned: string;
  total_commission_earned: string;
  total_deposited: string;
  total_withdrawn: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  tokens: { access: string; refresh: string };
}

// ─── instruments ──────────────────────────────────────────────────────────

export interface Instrument {
  id: string;
  name: string;
  symbol: string;
  issuer: string | null;
  issuer_name: string | null;
  issuer_logo: string | null;
  category: string;
  category_label: string;
  description: string;
  currency: string;
  interest_rate: string;
  tenure_months: number;
  min_investment: string;
  max_investment: string | null;
  roi_plan: string | null;
  plan_name: string | null;
  price_source: 'manual' | 'feed';
  current_price: string;
  previous_close: string;
  day_high: string;
  day_low: string;
  change: string;
  change_percent: string;
  price_updated_at: string | null;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
}

export interface PriceTick {
  symbol: string;
  name: string;
  price: number;
  previous_close: number;
  change: number;
  change_percent: number;
  day_high: number;
  day_low: number;
  currency: string;
  updated_at: string;
}

export interface Issuer {
  id: string;
  name: string;
  short_name: string;
  logo: string | null;
  country: string;
  website: string;
  is_active: boolean;
  display_order: number;
}

// ─── investments ──────────────────────────────────────────────────────────

export interface PlanMonth {
  month_index: number;
  percent: string;
}

export interface RoiPlan {
  id: string;
  name: string;
  description: string;
  min_amount: string;
  max_amount: string | null;
  tenure_months: number;
  return_principal_at_maturity: boolean;
  allow_early_exit: boolean;
  early_exit_penalty_percent: string;
  is_active: boolean;
  display_order: number;
  months: PlanMonth[];
  total_return_percent: string;
  created_at?: string;
}

export interface RoiPayout {
  id: string;
  month_index: number;
  percent: string;
  base_amount: string;
  amount: string;
  due_at: string;
  status: 'paid' | 'skipped' | 'failed';
  credited_to: string;
  created_at: string;
}

export interface NextPayout {
  month_index: number;
  due_at: string;
  percent: number;
  estimated_amount: number;
  investment_id?: string;
  plan_name?: string;
}

export interface Investment {
  id: string;
  plan: string;
  plan_name: string;
  instrument: string | null;
  instrument_name: string | null;
  instrument_symbol: string | null;
  principal: string;
  start_date: string;
  maturity_date: string;
  status: 'active' | 'matured' | 'cancelled';
  months_paid: number;
  tenure_months: number;
  total_roi_paid: string;
  principal_released: boolean;
  plan_snapshot?: Record<string, unknown>;
  next_payout: NextPayout | null;
  payouts?: RoiPayout[];
  created_at: string;
}

export interface ProjectionRow {
  month: number;
  percent: number;
  payout: number;
  cumulative: number;
}

export interface Projection {
  plan: string;
  principal: number;
  tenure_months: number;
  total_return: number;
  total_return_percent: number;
  returns_principal: boolean;
  schedule: ProjectionRow[];
}

export interface InvestmentSummary {
  active_count: number;
  active_principal: number;
  total_roi_received: number;
  matured_count: number;
  upcoming_payouts: NextPayout[];
  wallet_balance: number;
}

// ─── wallet ───────────────────────────────────────────────────────────────

export type PaymentMethod = 'cash' | 'bank' | 'upi' | 'crypto';
export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface PaymentChannel {
  id: string;
  name: string;
  channel_type: PaymentMethod;
  channel_type_label: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  ifsc_code: string;
  branch: string;
  upi_id: string;
  wallet_address: string;
  network: string;
  qr_code: string | null;
  contact_person: string;
  contact_phone: string;
  office_address: string;
  instructions: string;
  min_amount: string;
  max_amount: string | null;
  is_active: boolean;
  display_order: number;
}

export interface Deposit {
  id: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  method_label: string;
  channel: string | null;
  channel_name: string | null;
  user_message: string;
  reference_no: string;
  proof: string | null;
  status: RequestStatus;
  admin_note: string;
  rejection_reason: string;
  reviewed_at: string | null;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  amount: string;
  fee: string;
  net_amount: string;
  currency: string;
  method: PaymentMethod;
  method_label: string;
  payout_details: Record<string, string>;
  user_message: string;
  status: RequestStatus;
  admin_note: string;
  rejection_reason: string;
  payout_reference: string;
  payout_proof: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  tx_type: string;
  tx_type_label: string;
  amount: string;
  balance_after: string;
  description: string;
  reference_id: string | null;
  reference_type: string;
  created_at: string;
}

export interface WalletSummary {
  wallet_balance: number;
  invested_balance: number;
  total_deposited: number;
  total_withdrawn: number;
  total_roi_earned: number;
  total_commission_earned: number;
  pending_deposit_amount: number;
  pending_deposit_count: number;
  pending_withdrawal_amount: number;
  pending_withdrawal_count: number;
}

// ─── MLM ──────────────────────────────────────────────────────────────────

export interface MlmLevel {
  level: number;
  label: string;
  kind: 'direct' | 'indirect';
  deposit_percent: string;
  roi_percent: string;
  min_direct_referrals: number;
  min_self_investment: string;
  is_active: boolean;
}

export interface MlmStructure {
  deposit_commission_enabled: boolean;
  roi_commission_enabled: boolean;
  max_levels: number;
  levels: MlmLevel[];
}

export interface Commission {
  id: string;
  level: number;
  kind: 'direct' | 'indirect';
  trigger: 'deposit' | 'roi' | 'investment';
  trigger_label: string;
  source_user: string;
  source_name: string;
  source_email: string;
  base_amount: string;
  percent: string;
  amount: string;
  status: 'paid' | 'skipped' | 'reversed';
  skip_reason: string;
  description: string;
  created_at: string;
}

export interface TreeNode {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  referral_code: string;
  level: number;
  status: string;
  kyc_status: string;
  joined_at: string | null;
  total_deposited: number;
  invested_balance: number;
  wallet_balance: number;
  total_roi_earned: number;
  commission_to_root: number;
  direct_referrals: number;
  children: TreeNode[];
}

export interface TreeResponse {
  tree: TreeNode[];
  total_nodes: number;
  levels: Record<string, number>;
  root: {
    user_id: string;
    name: string;
    email: string;
    referral_code: string;
    level: number;
    total_commission_earned: number;
  };
}

export interface NetworkLevel {
  level: number;
  count: number;
  business: number;
  invested: number;
}

export interface NetworkSummary {
  total_downline: number;
  direct_count: number;
  levels: NetworkLevel[];
  team_business: number;
  referral_code: string;
  referral_link: string;
}

export interface EarningsResponse {
  total_earned: number;
  direct_earned: number;
  indirect_earned: number;
  by_level: { level: number; total: number; count: number }[];
  by_trigger: Record<string, number>;
  network: NetworkSummary;
  referral_code: string;
  top_producing_members: {
    user_id: string;
    name: string;
    email: string;
    total: number;
  }[];
  structure: MlmLevel[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  notif_type: string;
  action_url: string;
  is_read: boolean;
  created_at: string;
}
