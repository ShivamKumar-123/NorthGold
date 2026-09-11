import {
  ADMIN, DEMO_PASSWORD, DEMO_PEOPLE, EMPTY_DB, INSTRUMENTS,
} from './seed';
import type {
  Commission, DB, Deposit, Investment, KycDoc, ReferralPlan, RoiPayout, RoiPlan,
  ProofType, SupportMessage, Transaction, TreeNode, User, UserStatus, Withdrawal,
} from './types';

/**
 * The whole backend, in the browser.
 *
 * Every rule the Django services enforce is reimplemented here: slab-matched
 * plans, month-by-month payout schedules frozen at purchase, cash deposits that
 * only move money once an administrator approves them, withdrawals that hold
 * funds at request time, and a referral programme that pays the direct sponsor
 * a percentage of their referral's deposit every month it earns.
 *
 * ── What is deliberately NOT production-grade ──────────────────────────────
 * Passwords are stored in plain text and every check runs client-side, so
 * anyone can open devtools and grant themselves a balance. That is fine for a
 * demo whose entire database is already in the reader's own localStorage —
 * there is nothing here to protect. It is not fine for anything real.
 */

const KEY = 'northgold_demo_db_v1';

/* ── Money ─────────────────────────────────────────────────────────────────
   Currency is held in paise-precision floats and rounded DOWN at every
   payout. Rounding half-up would, across twelve months and five commission
   levels, quietly pay out more than the schedule promises. */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const floor2 = (n: number) => Math.floor(n * 100) / 100;

const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** 8 characters, no vowels — a referral code should not spell anything. */
function referralCode(): string {
  const alphabet = '23456789BCDFGHJKLMNPQRSTVWXYZ';
  let out = '';
  for (let i = 0; i < 8; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/** Month arithmetic that clamps to the end of a short month: a deposit on the
 *  31st pays on the 28th in February, not on the 3rd of March. */
export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  const day = d.getDate();
  const target = new Date(d);
  target.setDate(1);
  target.setMonth(target.getMonth() + months);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  target.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), 0);
  return target.toISOString();
}

/* ── Persistence ─────────────────────────────────────────────────────────── */

let cache: DB | null = null;
const listeners = new Set<() => void>();

function emptyDb(): DB {
  return {
    ...EMPTY_DB,
    users: [],
    investments: [],
    payouts: [],
    deposits: [],
    withdrawals: [],
    transactions: [],
    commissions: [],
    kyc: [],
    messages: [],
  };
}

export function load(): DB {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      // A stored database from an older shape is not worth migrating in a
      // demo — reseeding is both simpler and more predictable.
      if (parsed.version === EMPTY_DB.version) {
        cache = parsed;
        return cache;
      }
    }
  } catch {
    /* Corrupt or unavailable storage falls through to a fresh seed. */
  }
  // `cache` is published BEFORE the seed runs, because seeding replays real
  // actions and those read back through `load()` — `planForAmount` is the
  // obvious one. Assigning only at the end makes every nested read re-enter
  // this function and recurse until the stack gives out.
  cache = emptyDb();
  seedInto(cache);
  save();
  return cache;
}

function save() {
  if (!cache) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* Private mode, or the quota is full. The session still works in memory. */
  }
  listeners.forEach((fn) => fn());
}

/** Subscribe to writes so screens re-read after an action. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Writes from another tab.
 *
 * `localStorage` is shared by every tab of a browser, but `cache` is not —
 * each tab parses its own copy once and then works from it. So a member
 * writing to support in one tab and the desk reading the inbox in another were
 * each looking at the snapshot their tab happened to load with: the message was
 * in storage and on neither screen until a reload.
 *
 * The `storage` event fires only in the OTHER tabs, which is exactly the ones
 * holding a stale copy. Dropping the cache makes the next read re-parse, and
 * the listeners are what tell the screens to read again.
 *
 * This cannot reach across two different BROWSERS — separate browsers keep
 * separate storage, so they are two separate databases. That is the demo's
 * whole design; the Django build behind the production app is what puts one
 * shared database under both sides.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return;
    cache = null;
    listeners.forEach((fn) => fn());
  });
}

export function resetDemo() {
  cache = emptyDb();
  seedInto(cache);
  save();
}

/* ── Seeding ───────────────────────────────────────────────────────────────
   The demo ships with a working network: seven members, an approved deposit
   each, the payouts that were due in the meantime, and the commission those
   payouts generated. Building it by REPLAYING the real actions — rather than
   writing plausible-looking balances straight in — means the ledger adds up
   and every screen agrees with every other screen. */

function seedInto(db: DB): DB {
  const now = Date.now();

  db.users.push({
    id: 'user_admin',
    email: ADMIN.email,
    password: ADMIN.password,
    first_name: ADMIN.first_name,
    last_name: ADMIN.last_name,
    phone: '',
    country: 'India',
    state: '',
    city: '',
    address: '',
    is_staff: true,
    status: 'active',
    kyc_status: 'approved',
    referral_code: referralCode(),
    sponsor_id: null,
    tree_depth: 0,
    wallet_balance: 0,
    invested_balance: 0,
    created_at: new Date(now - 400 * 86400_000).toISOString(),
  });

  const byKey = new Map<string, User>();
  DEMO_PEOPLE.forEach((person, i) => {
    const sponsor = person.sponsor ? byKey.get(person.sponsor) ?? null : null;
    const user: User = {
      id: `user_${person.key}`,
      email: person.email,
      password: DEMO_PASSWORD,
      first_name: person.first,
      last_name: person.last,
      phone: `+91 90000 0000${i}`,
      country: 'India',
      state: 'Maharashtra',
      city: 'Mumbai',
      address: '',
      is_staff: false,
      status: 'active',
      kyc_status: i < 4 ? 'approved' : 'pending',
      referral_code: referralCode(),
      sponsor_id: sponsor?.id ?? null,
      tree_depth: sponsor ? sponsor.tree_depth + 1 : 0,
      wallet_balance: 0,
      invested_balance: 0,
      created_at: new Date(now - (person.monthsAgo * 30 + 10) * 86400_000).toISOString(),
    };
    db.users.push(user);
    byKey.set(person.key, user);

    // Every account here was opened the way the signup form now opens one, so
    // each member carries the same documents. Their state follows the
    // member's own: the approved ones are approved throughout, and the rest
    // are still sitting in the queue for somebody to work through.
    for (const doc of KYC_DOC_TYPES) {
      db.kyc.push({
        id: uid('kyc'),
        user_id: user.id,
        doc_type: doc.value,
        proof_type: ID_DOC_TYPES.includes(doc.value) ? ('aadhaar' as const) : ('' as const),
        file_name: `${person.key}-${doc.value}.jpg`,
        status: user.kyc_status === 'approved' ? 'approved' : 'pending',
        rejection_reason: '',
        reviewed_at: user.kyc_status === 'approved' ? user.created_at : null,
        created_at: user.created_at,
      });
    }
  });

  // Replay each member's deposit at the date they actually joined, then let
  // the payout engine catch every month that has since fallen due.
  DEMO_PEOPLE.forEach((person) => {
    const user = byKey.get(person.key)!;
    const at = addMonths(new Date().toISOString(), -person.monthsAgo);
    const deposit: Deposit = {
      id: uid('dep'),
      user_id: user.id,
      amount: person.deposit,
      method: 'cash',
      reference: `RCPT${Math.floor(100000 + Math.random() * 899999)}`,
      user_message: `Handed $${person.deposit.toLocaleString('en-US')} in cash at the head office counter.`,
      status: 'pending',
      admin_note: '',
      created_at: at,
      reviewed_at: null,
    };
    db.deposits.push(deposit);
    approveDepositIn(db, deposit.id, 'Verified against counter receipt.', at);
  });

  runDuePayoutsIn(db);

  // A couple of live queue items so the admin screens have something to do.
  const sneha = byKey.get('sneha')!;
  db.deposits.push({
    id: uid('dep'),
    user_id: sneha.id,
    amount: 2500,
    method: 'cash',
    reference: 'RCPT774120',
    user_message: 'Handed $2,500 to Rakesh at the Andheri counter on Tuesday, receipt 774120.',
    status: 'pending',
    admin_note: '',
    created_at: new Date(now - 2 * 86400_000).toISOString(),
    reviewed_at: null,
  });

  // Priya, not one of the smaller accounts: after auto-investing their
  // deposit, most members hold only a few hundred rupees in returns, and a
  // withdrawal larger than the balance would (correctly) be refused — leaving
  // the admin queue empty and the screen looking broken.
  const priya = byKey.get('priya')!;
  if (priya.wallet_balance >= 1500) {
    requestWithdrawalIn(db, priya.id, 1500,
      'I will collect from the head office counter on Friday afternoon.');
  }

  // Two support threads: one already answered, one still waiting. An inbox
  // that opens empty says nothing about how it behaves once it is not.
  const thread = (key: string, lines: Array<['user' | 'admin', string, number]>) => {
    const owner = byKey.get(key);
    if (!owner) return;
    for (const [sender, body, hoursAgo] of lines) {
      db.messages.push({
        id: uid('msg'),
        user_id: owner.id,
        sender,
        author_name: sender === 'admin' ? 'Admin Desk' : '',
        body,
        // The member's last line is deliberately unread, so the inbox opens
        // with a badge on it.
        read_at: sender === 'admin' ? new Date(now - hoursAgo * 3600_000).toISOString() : null,
        created_at: new Date(now - hoursAgo * 3600_000).toISOString(),
        reply_to: null,
        reactions: {},
        starred_by: [],
        edited_at: null,
        forwarded: false,
      });
    }
  };

  thread('arjun', [
    ['user', 'Hello, I handed over $8,000 at the counter this morning. How long does verification usually take?', 52],
    ['admin', 'Thanks Arjun — we verify against the receipt number, usually the same working day. Yours is already approved.', 50],
    ['user', 'Perfect, I can see it. Thank you!', 49],
  ]);
  thread('neha', [
    ['user', 'When exactly does my second monthly return land? I deposited on the 12th.', 6],
    ['admin', 'On the 12th of each month — the schedule runs from your own deposit date, not the calendar month.', 5],
    ['user', 'Understood. One more thing — can I withdraw the return as soon as it arrives?', 2],
  ]);

  return db;
}

/* ── Reads ─────────────────────────────────────────────────────────────── */

export const getUsers = () => load().users;
export const getUser = (id: string | null) => (id ? load().users.find((u) => u.id === id) ?? null : null);
export const getPlans = () => load().plans.filter((p) => p.is_active).sort((a, b) => a.display_order - b.display_order);
export const getReferralPlans = () =>
  load().referral_plans.slice().sort((a, b) => a.display_order - b.display_order);

/** Replace one slab, matrix included. The months arrive as a complete set:
 *  saving cell by cell can leave a rate table half-updated, and a half-updated
 *  rate table pays real money. */
export function saveReferralPlan(planId: string, patch: Partial<ReferralPlan>) {
  const db = load();
  const plan = db.referral_plans.find((p) => p.id === planId);
  if (!plan) throw new Error('No such referral slab.');
  Object.assign(plan, patch);
  save();
}
export const getSettings = () => load().settings;
export const getIssuers = () => load().issuers;
export const getInstruments = () => load().instruments;

export const depositsFor = (userId: string) =>
  load().deposits.filter((d) => d.user_id === userId).sort(byNewest);
export const withdrawalsFor = (userId: string) =>
  load().withdrawals.filter((w) => w.user_id === userId).sort(byNewest);
export const transactionsFor = (userId: string) =>
  load().transactions.filter((t) => t.user_id === userId).sort(byNewest);
export const investmentsFor = (userId: string) =>
  load().investments.filter((i) => i.user_id === userId).sort(byNewest);
export const payoutsFor = (userId: string) =>
  load().payouts.filter((p) => p.user_id === userId).sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1));
export const commissionsFor = (userId: string) =>
  load().commissions.filter((c) => c.earner_id === userId && !c.skipped_reason).sort(byNewest);
/** Including the skipped ones — a level that paid nothing because it was not
 *  unlocked is exactly what a member needs to see in their ledger. */
export const allCommissionsFor = (userId: string) =>
  load().commissions.filter((c) => c.earner_id === userId).sort(byNewest);

export const pendingDeposits = () => load().deposits.filter((d) => d.status === 'pending').sort(byNewest);
export const pendingWithdrawals = () => load().withdrawals.filter((w) => w.status === 'pending').sort(byNewest);
export const allDeposits = () => load().deposits.slice().sort(byNewest);
export const allWithdrawals = () => load().withdrawals.slice().sort(byNewest);

function byNewest(a: { created_at: string }, b: { created_at: string }) {
  return a.created_at < b.created_at ? 1 : -1;
}

/** The plan whose slab contains this amount. Slabs never overlap, and the top
 *  tier is open-ended, so exactly one matches for any amount at or above the
 *  entry minimum. */
export function planForAmount(amount: number): RoiPlan | null {
  return (
    getPlans().find(
      (p) => amount >= p.min_amount && (p.max_amount === null || amount <= p.max_amount),
    ) ?? null
  );
}

/** The full month-by-month schedule for an amount, without committing to it —
 *  this is what the landing-page calculator draws. */
export function projectedSchedule(amount: number, plan: RoiPlan) {
  let running = 0;
  return plan.months.map((percent, i) => {
    const payout = floor2((amount * percent) / 100);
    running = round2(running + payout);
    return { month: i + 1, percent, payout, cumulative: running };
  });
}

/* ── Auth ──────────────────────────────────────────────────────────────── */

export function findByEmail(email: string) {
  const wanted = email.trim().toLowerCase();
  return load().users.find((u) => u.email.toLowerCase() === wanted) ?? null;
}

export function login(email: string, password: string): User {
  const user = findByEmail(email);
  if (!user || user.password !== password) throw new Error('Those credentials do not match an account.');
  if (user.status === 'blocked') throw new Error('This account has been blocked. Contact support.');
  if (user.status === 'archived') throw new Error('This account has been closed.');
  return user;
}

/** The identity documents an account cannot be opened without. Shared by the
 *  signup form, the profile page and the admin review queue so all three name
 *  the same things. */
/** The identity documents a member can prove themselves with. */
export const PROOF_TYPES: Array<{ value: ProofType; label: string }> = [
  { value: 'aadhaar', label: 'Aadhaar card' },
  { value: 'pan', label: 'PAN card' },
  { value: 'national_id', label: 'National ID' },
];

/** The two pages that carry a proof type. A selfie is not an Aadhaar. */
export const ID_DOC_TYPES = ['id_front', 'id_back'];

export const KYC_DOC_TYPES = [
  { value: 'id_front', label: 'ID — front' },
  { value: 'id_back', label: 'ID — back' },
  { value: 'selfie', label: 'Selfie with ID' },
] as const;

export function register(input: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  country?: string;
  referral_code?: string;
  /** Which identity document the two ID pages are. Asked once, stored on
   *  both — a reviewer cannot check a number format without knowing which
   *  document they are holding. */
  proof_type: ProofType;
  /** doc_type -> file name. All of them are required: the account and the
   *  documents it was opened against are written together, so nobody can
   *  exist here without something for an administrator to verify. */
  documents: Record<string, string>;
}): User {
  const db = load();
  if (findByEmail(input.email)) throw new Error('An account with that email already exists.');

  const missing = KYC_DOC_TYPES.filter((d) => !(input.documents?.[d.value] || '').trim());
  if (missing.length) {
    throw new Error(`Attach every document to continue: ${missing.map((d) => d.label).join(', ')}.`);
  }

  // An unknown referral code is ignored rather than blocking the signup — the
  // person joining did not choose it and should not be stopped by it.
  const code = (input.referral_code || '').trim().toUpperCase();
  const sponsor = code ? db.users.find((u) => u.referral_code === code) ?? null : null;

  const user: User = {
    id: uid('user'),
    email: input.email.trim(),
    password: input.password,
    first_name: input.first_name.trim(),
    last_name: input.last_name.trim(),
    phone: input.phone ?? '',
    country: input.country ?? '',
    state: '',
    city: '',
    address: '',
    is_staff: false,
    status: 'active',
    // Straight to `pending`: the documents go in with the account below, so
    // the review queue has something in it from the very first moment.
    kyc_status: 'pending',
    referral_code: referralCode(),
    sponsor_id: sponsor?.id ?? null,
    tree_depth: sponsor ? sponsor.tree_depth + 1 : 0,
    wallet_balance: 0,
    invested_balance: 0,
    created_at: new Date().toISOString(),
  };
  db.users.push(user);

  const now = new Date().toISOString();
  for (const doc of KYC_DOC_TYPES) {
    db.kyc.push({
      id: uid('kyc'),
      user_id: user.id,
      doc_type: doc.value,
      proof_type: ID_DOC_TYPES.includes(doc.value) ? input.proof_type : '',
      file_name: input.documents[doc.value].trim(),
      status: 'pending',
      rejection_reason: '',
      reviewed_at: null,
      created_at: now,
    });
  }

  save();
  return user;
}

export function updateProfile(userId: string, patch: Partial<User>) {
  const db = load();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error('No such account.');
  Object.assign(user, patch);
  save();
  return user;
}

/* ── Ledger ────────────────────────────────────────────────────────────── */

function credit(db: DB, user: User, amount: number, kind: Transaction['kind'], note: string, at?: string) {
  user.wallet_balance = round2(user.wallet_balance + amount);
  db.transactions.push({
    id: uid('tx'),
    user_id: user.id,
    kind,
    amount: round2(amount),
    balance_after: user.wallet_balance,
    note,
    created_at: at ?? new Date().toISOString(),
  });
}

/* ── Deposits ──────────────────────────────────────────────────────────── */

export function createDeposit(userId: string, amount: number, message: string, reference: string) {
  const db = load();
  if (amount < db.settings.deposit_min_amount) {
    throw new Error(`The minimum deposit is $${db.settings.deposit_min_amount}.`);
  }
  // Cash leaves no bank trail, so the member's description of the handover is
  // the only thing the administrator has to verify against.
  if (!message.trim()) throw new Error('Describe the cash handover — who took it, where, and when.');

  const deposit: Deposit = {
    id: uid('dep'),
    user_id: userId,
    amount: round2(amount),
    method: 'cash',
    reference: reference.trim(),
    user_message: message.trim(),
    status: 'pending',
    admin_note: '',
    created_at: new Date().toISOString(),
  reviewed_at: null,
  };
  db.deposits.push(deposit);
  save();
  return deposit;
}

function approveDepositIn(db: DB, depositId: string, note: string, at?: string) {
  const deposit = db.deposits.find((d) => d.id === depositId);
  if (!deposit || deposit.status !== 'pending') return;
  const user = db.users.find((u) => u.id === deposit.user_id);
  if (!user) return;

  const when = at ?? new Date().toISOString();
  deposit.status = 'approved';
  deposit.admin_note = note;
  deposit.reviewed_at = when;

  credit(db, user, deposit.amount, 'deposit', `Cash deposit approved · ${deposit.reference || 'no receipt'}`, when);

  if (db.settings.auto_invest_on_deposit) {
    openInvestmentIn(db, user, deposit.amount, when);
  }
  // No commission is paid here any more: the programme pays the sponsor once
  // a month against the investment, where the rate and the month both live.
}

export function approveDeposit(depositId: string, note = '') {
  const db = load();
  approveDepositIn(db, depositId, note);
  save();
}

export function rejectDeposit(depositId: string, note = '') {
  const db = load();
  const deposit = db.deposits.find((d) => d.id === depositId);
  if (!deposit || deposit.status !== 'pending') return;
  deposit.status = 'rejected';
  deposit.admin_note = note;
  deposit.reviewed_at = new Date().toISOString();
  save();
}

/* ── Investments ───────────────────────────────────────────────────────── */

function openInvestmentIn(db: DB, user: User, amount: number, at: string) {
  const plan = planForAmount(amount);
  if (!plan) return null;

  // The schedule is COPIED, not referenced. Editing the plan tomorrow must
  // not change what this member was promised today.
  const investment: Investment = {
    id: uid('inv'),
    user_id: user.id,
    plan_id: plan.id,
    plan_snapshot: { name: plan.name, tenure_months: plan.tenure_months, months: [...plan.months] },
    amount: round2(amount),
    start_date: at,
    maturity_date: addMonths(at, plan.tenure_months),
    months_paid: 0,
    total_returned: 0,
    status: 'active',
    created_at: at,
  };
  db.investments.push(investment);

  user.wallet_balance = round2(user.wallet_balance - amount);
  user.invested_balance = round2(user.invested_balance + amount);
  db.transactions.push({
    id: uid('tx'),
    user_id: user.id,
    kind: 'investment',
    amount: -round2(amount),
    balance_after: user.wallet_balance,
    note: `Invested in ${plan.name}`,
    created_at: at,
  });
  return investment;
}

/** Opens an investment from wallet balance the member already holds — the
 *  manual counterpart to the automatic one an approved deposit triggers. */
export function invest(userId: string, amount: number, planId?: string) {
  const db = load();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error('No such account.');
  if (amount > user.wallet_balance) throw new Error('That is more than your available balance.');

  const plan = planId ? db.plans.find((p) => p.id === planId) ?? null : planForAmount(amount);
  if (!plan) throw new Error('No plan covers that amount.');
  if (amount < plan.min_amount) {
    throw new Error(`${plan.name} starts at $${plan.min_amount.toLocaleString('en-US')}.`);
  }

  const investment = openInvestmentIn(db, user, amount, new Date().toISOString());
  save();
  return investment;
}

/**
 * Pays every month that has fallen due on every active investment.
 *
 * Idempotent by construction: `months_paid` is the cursor, so running this
 * twice in a row pays nothing the second time. That matters because it runs on
 * every page load — the demo has no cron, so "time passing" is simulated by
 * checking the schedule against the clock whenever anyone opens the app.
 */
function runDuePayoutsIn(db: DB): number {
  const now = Date.now();
  let paid = 0;

  db.investments
    .filter((inv) => inv.status === 'active')
    .forEach((inv) => {
      const user = db.users.find((u) => u.id === inv.user_id);
      if (!user) return;

      const { months } = inv.plan_snapshot;
      while (inv.months_paid < months.length) {
        const monthIndex = inv.months_paid + 1;
        const due = addMonths(inv.start_date, monthIndex);
        if (new Date(due).getTime() > now) break;

        const percent = months[monthIndex - 1];
        const amount = floor2((inv.amount * percent) / 100);

        db.payouts.push({
          id: uid('pay'),
          investment_id: inv.id,
          user_id: user.id,
          month_index: monthIndex,
          percent,
          amount,
          paid_at: due,
        });
        credit(db, user, amount, 'roi_payout',
          `${inv.plan_snapshot.name} · month ${monthIndex} at ${percent}%`, due);

        inv.months_paid = monthIndex;
        inv.total_returned = round2(inv.total_returned + amount);
        paid += 1;

        payReferralIn(db, user, inv, monthIndex, due);
      }

      if (inv.months_paid >= months.length) {
        inv.status = 'matured';
        user.invested_balance = round2(user.invested_balance - inv.amount);
        credit(db, user, inv.amount, 'principal_return',
          `${inv.plan_snapshot.name} matured · principal returned`, inv.maturity_date);
      }
    });

  return paid;
}

/** Called on app start. Returns how many payouts were credited, so the UI can
 *  say so rather than having balances change silently. */
export function catchUpPayouts(): number {
  const db = load();
  const paid = runDuePayoutsIn(db);
  if (paid) save();
  return paid;
}

/* ── Withdrawals ───────────────────────────────────────────────────────── */

function requestWithdrawalIn(db: DB, userId: string, amount: number, message: string) {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error('No such account.');
  if (amount < db.settings.withdrawal_min_amount) {
    throw new Error(`The minimum withdrawal is $${db.settings.withdrawal_min_amount}.`);
  }
  if (amount > user.wallet_balance) throw new Error('That is more than your available balance.');
  if (!message.trim()) throw new Error('Tell us where and when you want to collect the cash.');

  // Funds are held at REQUEST time, not at approval. Otherwise the same
  // balance could be promised to two pending withdrawals at once.
  credit(db, user, -amount, 'withdrawal_hold', 'Withdrawal requested · amount held');

  const withdrawal: Withdrawal = {
    id: uid('wd'),
    user_id: userId,
    amount: round2(amount),
    method: 'cash',
    user_message: message.trim(),
    status: 'pending',
    admin_note: '',
    created_at: new Date().toISOString(),
    reviewed_at: null,
  };
  db.withdrawals.push(withdrawal);
  return withdrawal;
}

export function requestWithdrawal(userId: string, amount: number, message: string) {
  const db = load();
  const w = requestWithdrawalIn(db, userId, amount, message);
  save();
  return w;
}

export function approveWithdrawal(id: string, note = '') {
  const db = load();
  const w = db.withdrawals.find((x) => x.id === id);
  if (!w || w.status !== 'pending') return;
  w.status = 'approved';
  w.admin_note = note;
  w.reviewed_at = new Date().toISOString();
  const user = db.users.find((u) => u.id === w.user_id);
  // The hold already left the wallet; approving only records the payout.
  if (user) {
    db.transactions.push({
      id: uid('tx'),
      user_id: user.id,
      kind: 'withdrawal',
      amount: 0,
      balance_after: user.wallet_balance,
      note: `Cash withdrawal of $${w.amount.toLocaleString('en-US')} handed over`,
      created_at: w.reviewed_at,
    });
  }
  save();
}

export function rejectWithdrawal(id: string, note = '') {
  const db = load();
  const w = db.withdrawals.find((x) => x.id === id);
  if (!w || w.status !== 'pending') return;
  w.status = 'rejected';
  w.admin_note = note;
  w.reviewed_at = new Date().toISOString();
  const user = db.users.find((u) => u.id === w.user_id);
  // Rejection must return the held amount, or the money simply vanishes.
  if (user) credit(db, user, w.amount, 'withdrawal_refund', 'Withdrawal rejected · amount returned');
  save();
}

/* ── Referrals ─────────────────────────────────────────────────────────────
   One payment, to one person, once a month.

   When a member's investment pays its month-N return, that member's DIRECT
   sponsor earns a percentage of what the member deposited — not of the return
   they just received. The percentage comes from the referral matrix: the
   deposit picks a slab, the slab holds a rate for each month.

   There are no levels and no qualification gates. Nobody above the sponsor
   earns anything, and approving a deposit pays nobody at all. */

/** The active slab covering an amount. Ties break to the higher floor, so
 *  overlapping slabs resolve to the most specific rather than an arbitrary
 *  one. */
export function referralPlanForAmount(amount: number): ReferralPlan | null {
  return (
    getReferralPlans()
      .filter((p) => amount >= p.min_amount && (p.max_amount === null || amount <= p.max_amount))
      .sort((a, b) => b.min_amount - a.min_amount)[0] ?? null
  );
}

function payReferralIn(db: DB, investor: User, investment: Investment, monthIndex: number, at: string) {
  if (!db.settings.referral_enabled) return;

  const sponsor = investor.sponsor_id
    ? db.users.find((u) => u.id === investor.sponsor_id) ?? null
    : null;
  if (!sponsor) return;

  const plan = db.referral_plans
    .filter((p) => p.is_active)
    .filter((p) => investment.amount >= p.min_amount
      && (p.max_amount === null || investment.amount <= p.max_amount))
    .sort((a, b) => b.min_amount - a.min_amount)[0];
  if (!plan) return;

  const percent = plan.months[monthIndex - 1] ?? 0;
  if (percent <= 0) return;

  // The base is the DEPOSIT, not the return the investor just received.
  const amount = floor2((investment.amount * percent) / 100);
  if (amount <= 0) return;

  const already = db.commissions.some(
    (c) => c.earner_id === sponsor.id
      && c.from_user_id === investor.id
      && c.month_index === monthIndex
      && c.investment_id === investment.id,
  );
  if (already) return;

  db.commissions.push({
    id: uid('com'),
    earner_id: sponsor.id,
    from_user_id: investor.id,
    investment_id: investment.id,
    month_index: monthIndex,
    base_amount: round2(investment.amount),
    percent,
    amount,
    skipped_reason: null,
    created_at: at,
  });

  credit(db, sponsor, amount, 'commission',
    `Referral commission on ${investor.first_name} ${investor.last_name}'s deposit, month ${monthIndex}`,
    at);
}

/** The referral tree under a user, to a depth. The root itself is level 0 and
 *  the graph draws it as "you". */
export function downlineTree(rootId: string, maxDepth = 5): TreeNode[] {
  const db = load();
  const root = db.users.find((u) => u.id === rootId);
  if (!root) return [];

  const earnedFrom = (fromId: string) =>
    db.commissions
      .filter((c) => c.earner_id === rootId && c.from_user_id === fromId && !c.skipped_reason)
      .reduce((sum, c) => sum + c.amount, 0);

  const depositedBy = (userId: string) =>
    db.deposits
      .filter((d) => d.user_id === userId && d.status === 'approved')
      .reduce((sum, d) => sum + d.amount, 0);

  const build = (user: User, level: number): TreeNode => ({
    user_id: user.id,
    name: `${user.first_name} ${user.last_name}`.trim() || user.email,
    email: user.email,
    phone: user.phone,
    country: user.country,
    referral_code: user.referral_code,
    status: 'active',
    level,
    joined_at: user.created_at,
    invested_balance: user.invested_balance,
    total_deposited: round2(depositedBy(user.id)),
    commission_to_root: round2(earnedFrom(user.id)),
    total_roi_earned: round2(
      db.payouts.filter((p) => p.user_id === user.id).reduce((sum, p) => sum + p.amount, 0),
    ),
    kyc_status: user.kyc_status,
    // Counted against the whole user list, NOT against the children we built
    // — at the depth cutoff `children` is empty while the real count is not,
    // and reporting 0 there is simply wrong.
    direct_referrals: db.users.filter((u) => u.sponsor_id === user.id).length,
    children:
      level < maxDepth
        ? db.users.filter((u) => u.sponsor_id === user.id).map((child) => build(child, level + 1))
        : [],
  });

  return db.users.filter((u) => u.sponsor_id === rootId).map((child) => build(child, 1));
}

export function downlineSummary(rootId: string) {
  const db = load();
  const flat: TreeNode[] = [];
  const walk = (n: TreeNode) => {
    flat.push(n);
    n.children.forEach(walk);
  };
  downlineTree(rootId).forEach(walk);

  const commissions = db.commissions.filter((c) => c.earner_id === rootId && !c.skipped_reason);
  return {
    direct: flat.filter((n) => n.level === 1).length,
    total: flat.length,
    team_business: round2(flat.reduce((s, n) => s + n.invested_balance, 0)),
    // Every payment is direct now — there is nothing else to split it into.
    from_direct: round2(commissions.reduce((s, c) => s + c.amount, 0)),
    from_indirect: 0,
    earned: round2(commissions.reduce((s, c) => s + c.amount, 0)),
    members: flat,
  };
}

/* ── Wallet summary ────────────────────────────────────────────────────── */

export function walletSummary(userId: string) {
  const db = load();
  const user = db.users.find((u) => u.id === userId)!;
  const pendingDeps = db.deposits.filter((d) => d.user_id === userId && d.status === 'pending');
  const pendingWds = db.withdrawals.filter((w) => w.user_id === userId && w.status === 'pending');
  const payouts = db.payouts.filter((p) => p.user_id === userId);
  const commission = db.commissions.filter((c) => c.earner_id === userId && !c.skipped_reason);

  return {
    wallet_balance: user.wallet_balance,
    invested_balance: user.invested_balance,
    pending_deposit_amount: round2(pendingDeps.reduce((s, d) => s + d.amount, 0)),
    pending_deposit_count: pendingDeps.length,
    pending_withdrawal_amount: round2(pendingWds.reduce((s, w) => s + w.amount, 0)),
    pending_withdrawal_count: pendingWds.length,
    total_returned: round2(payouts.reduce((s, p) => s + p.amount, 0)),
    total_commission: round2(commission.reduce((s, c) => s + c.amount, 0)),
  };
}

/** The next payouts due across a member's active investments. */
export function upcomingPayouts(userId: string, limit = 5) {
  const db = load();
  return db.investments
    .filter((i) => i.user_id === userId && i.status === 'active')
    .map((inv) => {
      const monthIndex = inv.months_paid + 1;
      const percent = inv.plan_snapshot.months[monthIndex - 1];
      if (percent === undefined) return null;
      return {
        investment_id: inv.id,
        plan: inv.plan_snapshot.name,
        month_index: monthIndex,
        due: addMonths(inv.start_date, monthIndex),
        percent,
        amount: floor2((inv.amount * percent) / 100),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (a.due < b.due ? -1 : 1))
    .slice(0, limit);
}

/* ── KYC ───────────────────────────────────────────────────────────────── */

export const kycFor = (userId: string) =>
  load().kyc.filter((d) => d.user_id === userId).sort(byNewest);

export const pendingKyc = () => load().kyc.filter((d) => d.status === 'pending').sort(byNewest);

/** Everything the desk has ever seen, newest first — the admin page shows the
 *  decided ones too, so a mistaken rejection can be found again rather than
 *  vanishing out of the queue. */
export const allKyc = () => load().kyc.slice().sort(byNewest);

export function uploadKyc(
  userId: string,
  docType: string,
  fileName: string,
  proofType: ProofType | '' = '',
) {
  const db = load();
  db.kyc.push({
    id: uid('kyc'),
    user_id: userId,
    doc_type: docType,
    // Only the ID pages carry it, whatever the caller passed.
    proof_type: ID_DOC_TYPES.includes(docType) ? proofType : '',
    file_name: fileName,
    status: 'pending',
    rejection_reason: '',
    reviewed_at: null,
    created_at: new Date().toISOString(),
  });
  // Uploading anything moves the account out of "unverified" — the queue now
  // has something in it, which is what `pending` means.
  const user = db.users.find((u) => u.id === userId);
  if (user && user.kyc_status === 'unverified') user.kyc_status = 'pending';
  save();
}

export function reviewKyc(docId: string, approve: boolean, reason = '') {
  const db = load();
  const doc = db.kyc.find((d) => d.id === docId);
  if (!doc || doc.status !== 'pending') return;
  doc.status = approve ? 'approved' : 'rejected';
  doc.rejection_reason = approve ? '' : reason;
  doc.reviewed_at = new Date().toISOString();

  const user = db.users.find((u) => u.id === doc.user_id);
  if (user) {
    const mine = db.kyc.filter((d) => d.user_id === user.id);
    // Approved once every document is in and none was rejected.
    if (mine.some((d) => d.status === 'rejected')) user.kyc_status = 'rejected';
    else if (mine.every((d) => d.status === 'approved')) user.kyc_status = 'approved';
    else user.kyc_status = 'pending';
  }
  save();
}

export function changePassword(userId: string, current: string, next: string) {
  const db = load();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error('No such account.');
  if (user.password !== current) throw new Error('Your current password is not correct.');
  if (next.length < 8) throw new Error('Your new password must be at least 8 characters.');
  user.password = next;
  save();
}

/* ── Admin actions on a member ─────────────────────────────────────────────
   Every money action writes one ledger row, exactly as the member's own
   deposits and payouts do — an adjustment nobody can trace is worse than no
   adjustment at all. */

function adjustIn(db: DB, userId: string, delta: number, note: string) {
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error('No such account.');
  const amount = floor2(delta);
  if (amount === 0) throw new Error('Enter an amount.');
  const next = round2(user.wallet_balance + amount);
  if (next < 0) throw new Error('That would leave a negative balance.');
  user.wallet_balance = next;
  db.transactions.push({
    id: uid('tx'),
    user_id: user.id,
    kind: 'adjustment',
    amount,
    balance_after: next,
    note: note || 'Administrator adjustment',
    created_at: new Date().toISOString(),
  });
}

/** Move a wallet by an amount. Negative takes money out. */
export function adminAdjustBalance(userId: string, amount: number, note: string) {
  const db = load();
  adjustIn(db, userId, amount, note);
  save();
}

/** Set a wallet to an exact figure.
 *
 *  The difference is worked out here rather than in the screen that called it:
 *  "make it 800" is a different instruction from "add 300", and turning the
 *  first into the second against a figure read a moment ago would overwrite
 *  anything credited in between. */
export function adminSetBalance(userId: string, target: number, note: string) {
  const db = load();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error('No such account.');
  if (target < 0) throw new Error('A balance cannot be set below zero.');
  const delta = round2(floor2(target) - user.wallet_balance);
  if (delta === 0) throw new Error('That is already the balance.');
  adjustIn(db, userId, delta, note || `Balance set to ${floor2(target)}`);
  save();
}

export function adminSetPassword(userId: string, next: string) {
  if (next.trim().length < 8) throw new Error('Use at least 8 characters.');
  const db = load();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error('No such account.');
  user.password = next.trim();
  save();
}

export function setUserStatus(userId: string, status: UserStatus) {
  const db = load();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error('No such account.');
  if (user.is_staff) throw new Error('An administrator account cannot be blocked or closed here.');
  user.status = status;
  save();
}

/** Everything the desk needs about one member, in the shape the detail panel
 *  draws. Assembled here so the screen does not have to know which table each
 *  figure lives in. */
export function memberDetail(userId: string) {
  const db = load();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return null;

  const deposits = db.deposits.filter((d) => d.user_id === userId);
  const withdrawals = db.withdrawals.filter((w) => w.user_id === userId);
  const investments = db.investments.filter((i) => i.user_id === userId);
  const payouts = db.payouts.filter((p) => p.user_id === userId);
  const commissions = db.commissions.filter((c) => c.earner_id === userId && !c.skipped_reason);
  const network = downlineSummary(userId);

  return {
    user,
    sponsor: db.users.find((u) => u.id === user.sponsor_id) ?? null,
    deposited: round2(deposits.filter((d) => d.status === 'approved')
      .reduce((n, d) => n + d.amount, 0)),
    pending_deposits: deposits.filter((d) => d.status === 'pending').length,
    withdrawn: round2(withdrawals.filter((w) => w.status === 'approved')
      .reduce((n, w) => n + w.amount, 0)),
    pending_withdrawals: withdrawals.filter((w) => w.status === 'pending').length,
    active_investments: investments.filter((i) => i.status === 'active').length,
    roi_earned: round2(payouts.reduce((n, p) => n + p.amount, 0)),
    commission_earned: round2(commissions.reduce((n, c) => n + c.amount, 0)),
    kyc: db.kyc.filter((d) => d.user_id === userId),
    messages: db.messages.filter((m) => m.user_id === userId).length,
    network,
    recent: db.transactions
      .filter((t) => t.user_id === userId)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 8),
  };
}

/* ── Support chat ──────────────────────────────────────────────────────────
   A thread IS every message carrying the same `user_id`; there is no
   conversation record to keep in step with the messages inside it. */

export const messagesFor = (userId: string) =>
  load().messages
    .filter((m) => m.user_id === userId)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

/** Sending, with everything the message menu can attach. */
export function sendMessage(
  userId: string,
  sender: 'user' | 'admin',
  body: string,
  authorName = '',
  options: { replyTo?: string | null; forwarded?: boolean } = {},
) {
  const text = body.trim();
  if (!text) throw new Error('Write a message first.');
  const db = load();
  // A quote must belong to the same thread. The strip renders its text
  // verbatim, so one lifted from another conversation would leak it.
  const quoted = options.replyTo
    ? db.messages.find((m) => m.id === options.replyTo && m.user_id === userId)
    : null;
  db.messages.push({
    id: uid('msg'),
    user_id: userId,
    sender,
    author_name: authorName,
    body: text,
    read_at: null,
    created_at: new Date().toISOString(),
    reply_to: quoted?.id ?? null,
    reactions: {},
    starred_by: [],
    edited_at: null,
    forwarded: Boolean(options.forwarded),
  });
  save();
}

/** One reaction per person: a second choice replaces the first, and the same
 *  one again clears it. Holding two at once has no meaning here. */
export function toggleReaction(messageId: string, viewerId: string, emoji: string) {
  const db = load();
  const message = db.messages.find((m) => m.id === messageId);
  if (!message) return;
  const reactions: Record<string, string[]> = { ...(message.reactions ?? {}) };
  let had: string | null = null;
  for (const [existing, ids] of Object.entries(reactions)) {
    if (ids.includes(viewerId)) {
      had = existing;
      const left = ids.filter((i) => i !== viewerId);
      if (left.length) reactions[existing] = left;
      else delete reactions[existing];
    }
  }
  if (had !== emoji) reactions[emoji] = [...(reactions[emoji] ?? []), viewerId];
  message.reactions = reactions;
  save();
}

export function toggleStar(messageId: string, viewerId: string) {
  const db = load();
  const message = db.messages.find((m) => m.id === messageId);
  if (!message) return;
  const starred = message.starred_by ?? [];
  message.starred_by = starred.includes(viewerId)
    ? starred.filter((i) => i !== viewerId)
    : [...starred, viewerId];
  save();
}

/** Only your own words, and only while the other side has not read them.
 *  Editing something somebody already acted on rewrites history. */
export function editMessage(messageId: string, viewerSender: 'user' | 'admin', body: string) {
  const text = body.trim();
  if (!text) throw new Error('A message cannot be emptied — delete it instead.');
  const db = load();
  const message = db.messages.find((m) => m.id === messageId);
  if (!message) return;
  if (message.sender !== viewerSender) throw new Error('You can only edit your own messages.');
  if (message.read_at) throw new Error('This has already been read — send a correction instead.');
  message.body = text;
  message.edited_at = new Date().toISOString();
  save();
}

/** Opening a thread marks the OTHER side's messages as seen. Your own were
 *  never unread to you. */
export function markThreadRead(userId: string, viewer: 'user' | 'admin') {
  const db = load();
  const other = viewer === 'user' ? 'admin' : 'user';
  let touched = false;
  for (const m of db.messages) {
    if (m.user_id === userId && m.sender === other && !m.read_at) {
      m.read_at = new Date().toISOString();
      touched = true;
    }
  }
  if (touched) save();
}

/** Replies the member has not read — drives the dot on the launcher. */
export const unreadForMember = (userId: string) =>
  load().messages.filter((m) => m.user_id === userId && m.sender === 'admin' && !m.read_at).length;

export function deleteMessage(id: string) {
  const db = load();
  const index = db.messages.findIndex((m) => m.id === id);
  if (index === -1) return;
  db.messages.splice(index, 1);
  save();
}

export function deleteThread(userId: string) {
  const db = load();
  db.messages = db.messages.filter((m) => m.user_id !== userId);
  save();
}

/** The desk's inbox: one row per member who has ever written in, newest
 *  activity first. */
export function supportThreads() {
  const db = load();
  const byUser = new Map<string, SupportMessage[]>();
  for (const m of db.messages) {
    const list = byUser.get(m.user_id) ?? [];
    list.push(m);
    byUser.set(m.user_id, list);
  }

  return [...byUser.entries()]
    .map(([userId, list]) => {
      const sorted = list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
      const tail = sorted[sorted.length - 1];
      const user = db.users.find((u) => u.id === userId);
      return {
        user_id: userId,
        name: user ? `${user.first_name} ${user.last_name}`.trim() || user.email : 'Unknown',
        email: user?.email ?? '',
        kyc_status: user?.kyc_status ?? 'unverified',
        messages: sorted.length,
        unread: sorted.filter((m) => m.sender === 'user' && !m.read_at).length,
        last_at: tail.created_at,
        last_sender: tail.sender,
        last_body: tail.body.slice(0, 120),
      };
    })
    .sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
}

/* ── Admin ─────────────────────────────────────────────────────────────── */

export function platformStats() {
  const db = load();
  const approvedDeposits = db.deposits.filter((d) => d.status === 'approved');
  const approvedWithdrawals = db.withdrawals.filter((w) => w.status === 'approved');
  const members = db.users.filter((u) => !u.is_staff);
  const commissions = db.commissions.filter((c) => !c.skipped_reason);

  return {
    total_deposited: round2(approvedDeposits.reduce((s, d) => s + d.amount, 0)),
    total_withdrawn: round2(approvedWithdrawals.reduce((s, w) => s + w.amount, 0)),
    active_principal: round2(members.reduce((s, u) => s + u.invested_balance, 0)),
    members: members.length,
    invested_members: members.filter((u) => u.invested_balance > 0).length,
    roi_paid: round2(db.payouts.reduce((s, p) => s + p.amount, 0)),
    commission_paid: round2(commissions.reduce((s, c) => s + c.amount, 0)),
    // Every payment is to a direct sponsor now, so there is no split to make.
    commission_direct: round2(commissions.reduce((s, c) => s + c.amount, 0)),
    commission_indirect: 0,
    with_sponsor: members.filter((u) => u.sponsor_id).length,
    pending_deposits: db.deposits.filter((d) => d.status === 'pending').length,
    pending_deposit_amount: round2(
      db.deposits.filter((d) => d.status === 'pending').reduce((s, d) => s + d.amount, 0),
    ),
    pending_withdrawals: db.withdrawals.filter((w) => w.status === 'pending').length,
    pending_withdrawal_amount: round2(
      db.withdrawals.filter((w) => w.status === 'pending').reduce((s, w) => s + w.amount, 0),
    ),
    by_month: [...new Set(commissions.map((c) => c.month_index))]
      .sort((a, b) => a - b)
      .map((month) => ({
        month,
        payments: commissions.filter((c) => c.month_index === month).length,
        amount: round2(
          commissions.filter((c) => c.month_index === month).reduce((s, c) => s + c.amount, 0),
        ),
      })),
    top_sponsors: members
      .map((u) => ({ user: u, directs: db.users.filter((x) => x.sponsor_id === u.id).length }))
      .filter((r) => r.directs > 0)
      .sort((a, b) => b.directs - a.directs)
      .slice(0, 5),
  };
}

export function savePlan(plan: RoiPlan) {
  const db = load();
  const i = db.plans.findIndex((p) => p.id === plan.id);
  if (i >= 0) db.plans[i] = plan;
  else db.plans.push(plan);
  save();
}

export function saveReferralPlans(plans: DB['referral_plans']) {
  const db = load();
  db.referral_plans = plans;
  save();
}

export function saveSettings(patch: Partial<DB['settings']>) {
  const db = load();
  db.settings = { ...db.settings, ...patch };
  save();
}

/* ── Prices ────────────────────────────────────────────────────────────── */

/**
 * Nudges the feed-priced instruments, so the board is not frozen.
 *
 * A random walk bounded to ±0.4% per tick: large enough to see, small enough
 * that a demo left open for an hour does not drift somewhere absurd.
 */
export function tickPrices() {
  const db = load();
  db.instruments.forEach((ins) => {
    if (ins.price_source !== 'feed') return;
    const base = INSTRUMENTS.find((s) => s.id === ins.id)?.current_price ?? ins.current_price;
    const drift = (Math.random() - 0.5) * 0.008;
    const next = ins.current_price * (1 + drift);
    // Tethered to the seed price so the walk cannot wander off indefinitely.
    ins.current_price = round2(Math.min(Math.max(next, base * 0.94), base * 1.06));
    ins.change_percent = round2(((ins.current_price - base) / base) * 100);
  });
  save();
}
