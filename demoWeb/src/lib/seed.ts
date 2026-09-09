import type { DB, Instrument, Issuer, MlmLevel, RoiPlan, Settings, User } from './types';

/**
 * The seed. Deliberately the same numbers as `seed_platform.py` in the Django
 * build, so a figure on this demo can be checked against the real platform.
 */

export const MLM_LEVELS: MlmLevel[] = [
  { level: 1, label: 'Direct', deposit_percent: 5, roi_percent: 10, min_directs: 0 },
  { level: 2, label: 'Indirect L2', deposit_percent: 3, roi_percent: 5, min_directs: 1 },
  { level: 3, label: 'Indirect L3', deposit_percent: 2, roi_percent: 3, min_directs: 2 },
  { level: 4, label: 'Indirect L4', deposit_percent: 1, roi_percent: 2, min_directs: 3 },
  { level: 5, label: 'Indirect L5', deposit_percent: 0.5, roi_percent: 1, min_directs: 4 },
];

// Each plan is a deposit slab plus its month-by-month curve. The curves ramp:
// holding longer earns more, which is the incentive to stay invested.
export const ROI_PLANS: RoiPlan[] = [
  {
    id: 'plan-starter',
    name: 'Starter',
    description: 'Entry tier for deposits from $100 to $999.',
    min_amount: 100,
    max_amount: 999,
    tenure_months: 12,
    display_order: 1,
    months: [1, 1, 1, 1.1, 1.1, 1.1, 1.2, 1.2, 1.2, 1.25, 1.25, 1.5],
    is_active: true,
  },
  {
    id: 'plan-silver',
    name: 'Silver',
    description: 'For deposits from $1,000 to $4,999.',
    min_amount: 1000,
    max_amount: 4999,
    tenure_months: 12,
    display_order: 2,
    months: [1, 1.25, 1.25, 1.5, 1.5, 1.5, 1.75, 1.75, 1.75, 2, 2, 2.5],
    is_active: true,
  },
  {
    id: 'plan-gold',
    name: 'Gold',
    description: 'For deposits from $5,000 to $24,999.',
    min_amount: 5000,
    max_amount: 24999,
    tenure_months: 12,
    display_order: 3,
    months: [1.5, 1.5, 1.75, 1.75, 2, 2, 2, 2.25, 2.25, 2.5, 2.5, 3],
    is_active: true,
  },
  {
    id: 'plan-platinum',
    name: 'Platinum',
    description: 'Open-ended top tier for deposits of $25,000 and above.',
    min_amount: 25000,
    max_amount: null,
    tenure_months: 12,
    display_order: 4,
    months: [2, 2, 2.25, 2.25, 2.5, 2.5, 2.75, 2.75, 3, 3, 3.25, 3.5],
    is_active: true,
  },
];

export const ISSUERS: Issuer[] = [
  { id: 'iss-mrd', name: 'Meridian Bank', short_name: 'MRD', country: 'India' },
  { id: 'iss-apx', name: 'Apex Financial', short_name: 'APX', country: 'Singapore' },
  { id: 'iss-ngt', name: 'Northgate Trust', short_name: 'NGT', country: 'United Kingdom' },
];

export const INSTRUMENTS: Instrument[] = [
  {
    id: 'ins-1', symbol: 'MRD-FD12', name: 'Meridian 12-Month Fixed Deposit',
    issuer_name: 'Meridian Bank', category_label: 'Fixed Deposit', interest_rate: 8.4,
    tenure_months: 12, min_investment: 1000, currency: 'USD', current_price: 100,
    change_percent: 0, price_source: 'manual', is_featured: true,
  },
  {
    id: 'ins-2', symbol: 'MRD-RD12', name: 'Meridian Recurring Deposit',
    issuer_name: 'Meridian Bank', category_label: 'Recurring Deposit', interest_rate: 7.2,
    tenure_months: 12, min_investment: 100, currency: 'USD', current_price: 100,
    change_percent: 0, price_source: 'manual', is_featured: false,
  },
  {
    id: 'ins-3', symbol: 'APX-BND24', name: 'Apex Corporate Bond Series A',
    issuer_name: 'Apex Financial', category_label: 'Bond', interest_rate: 9.75,
    tenure_months: 12, min_investment: 5000, currency: 'USD', current_price: 1024.5,
    change_percent: 0, price_source: 'feed', is_featured: true,
  },
  {
    id: 'ins-4', symbol: 'NGT-MF01', name: 'Northgate Balanced Fund',
    issuer_name: 'Northgate Trust', category_label: 'Mutual Fund', interest_rate: 11.2,
    tenure_months: 12, min_investment: 25000, currency: 'USD', current_price: 486.25,
    change_percent: 0, price_source: 'feed', is_featured: true,
  },
  {
    id: 'ins-5', symbol: 'APX-ETF05', name: 'Apex Global Index ETF',
    issuer_name: 'Apex Financial', category_label: 'ETF', interest_rate: 10.5,
    tenure_months: 12, min_investment: 5000, currency: 'USD', current_price: 212.8,
    change_percent: 0, price_source: 'feed', is_featured: false,
  },
];

export const SETTINGS: Settings = {
  platform_name: 'NorthGold',
  support_email: 'support@northgold.demo',
  support_phone: '+91 98765 43210',
  support_whatsapp: '919876543210',
  support_hours: 'Mon–Sat, 10:00–19:00 IST',
  support_address: 'Grosvenor Place\nLevel 15, 2205 George St, Sydney NSW 2000, Australia',
  deposit_min_amount: 100,
  withdrawal_min_amount: 10,
  auto_invest_on_deposit: true,
  mlm_deposit_enabled: true,
  mlm_roi_enabled: true,
  mlm_max_levels: 5,
};

/** Demo accounts, so the tree and the queues are not empty on first load. */
export const DEMO_PEOPLE: Array<{
  key: string;
  email: string;
  first: string;
  last: string;
  sponsor: string | null;
  deposit: number;
  /** Months in the past the deposit was made — drives how many payouts exist. */
  monthsAgo: number;
}> = [
  { key: 'priya', email: 'priya@northgold.demo', first: 'Priya', last: 'Sharma', sponsor: null, deposit: 30000, monthsAgo: 5 },
  { key: 'arjun', email: 'arjun@northgold.demo', first: 'Arjun', last: 'Mehta', sponsor: 'priya', deposit: 8000, monthsAgo: 4 },
  { key: 'rahul', email: 'rahul@northgold.demo', first: 'Rahul', last: 'Iyer', sponsor: 'priya', deposit: 4000, monthsAgo: 3 },
  { key: 'sneha', email: 'sneha@northgold.demo', first: 'Sneha', last: 'Kapoor', sponsor: 'priya', deposit: 1500, monthsAgo: 3 },
  { key: 'neha', email: 'neha@northgold.demo', first: 'Neha', last: 'Verma', sponsor: 'arjun', deposit: 26000, monthsAgo: 2 },
  { key: 'vikram', email: 'vikram@northgold.demo', first: 'Vikram', last: 'Rao', sponsor: 'neha', deposit: 5500, monthsAgo: 1 },
  { key: 'anita', email: 'anita@northgold.demo', first: 'Anita', last: 'Desai', sponsor: 'rahul', deposit: 900, monthsAgo: 1 },
];

export const ADMIN: Pick<User, 'email' | 'password' | 'first_name' | 'last_name'> = {
  email: 'admin@northgold.demo',
  password: 'admin123',
  first_name: 'Admin',
  last_name: 'Desk',
};

/** One password for every demo account — this is a sandbox, not a product. */
export const DEMO_PASSWORD = 'demo1234';

export const EMPTY_DB: Omit<
  DB,
  | 'users' | 'investments' | 'payouts' | 'deposits' | 'withdrawals'
  | 'transactions' | 'commissions' | 'kyc' | 'messages'
> = {
  // 2: every seeded member carries the five KYC documents their account was
  //    opened with.
  // 3: the office address moved to Sydney. Settings live inside the stored
  //    database, so a reseed is what actually delivers the new one.
  // 4: support threads, so the admin inbox opens with something in it.
  // 5: accounts carry a status, so the desk can block or close one.
  // 6: the office address is stored across two lines, the way it is written.
  // A database stored under an older version is reseeded, not migrated.
  version: 6,
  plans: ROI_PLANS,
  levels: MLM_LEVELS,
  issuers: ISSUERS,
  instruments: INSTRUMENTS,
  settings: SETTINGS,
};
