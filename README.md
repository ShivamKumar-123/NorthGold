# Meridian Capital

A fixed-income investment platform: partner-bank instruments on a public price
board, deposits verified by an administrator, a **contracted monthly return**
that varies by deposit size and holding period, and a **multi-level referral
programme** that pays on both deposits and every monthly return.

## The two rules the platform runs on

**1. Monthly return = f(amount slab × holding month).**

A deposit lands in the plan whose slab covers its amount. That plan holds one
percentage per month of its term, so month 1 pays month 1's rate, month 2 pays
month 2's, and so on. Months are **deposit-relative** — month 3 falls on the
third monthly anniversary of *that* deposit, not on a calendar date.

| Plan | Slab | M1 | M2 | M3 | … | M12 | Total |
|---|---|---|---|---|---|---|---|
| Silver | 1,000 – 4,999 | 1.00% | 1.25% | 1.25% | … | 2.50% | 19.75% |
| Gold | 5,000 – 24,999 | 1.50% | 1.50% | 1.75% | … | 3.00% | 25.00% |
| Platinum | 25,000+ | 2.00% | 2.00% | 2.25% | … | 3.50% | 31.75% |

Every cell is editable from **Admin → ROI plans**. Terms are **frozen onto each
investment at purchase**, so editing a plan never changes what an existing
investor was promised.

**2. Referral commission pays up the sponsor chain, on two events.**

Level 1 is a **direct** referral; levels 2+ are **indirect**. Each level has two
independent rates:

| Level | Kind | On their deposit | On their monthly return | Unlocks at |
|---|---|---|---|---|
| L1 | direct | 5.0% | 10.0% | immediately |
| L2 | indirect | 3.0% | 5.0% | 1 direct referral |
| L3 | indirect | 2.0% | 3.0% | 2 direct referrals |
| L4 | indirect | 1.0% | 2.0% | 3 direct referrals |
| L5 | indirect | 0.5% | 1.0% | 4 direct referrals |

Editable from **Admin → MLM levels**. The deposit commission is one-off; the ROI
commission recurs every month the downline member is paid. An upline that fails
a level's qualification is recorded as `skipped` **with the reason**, never
silently dropped.

## Quick start

```bash
cp .env.example .env          # then fill in SECRET_KEY and POSTGRES_PASSWORD
docker compose up -d --build
```

| Surface | URL |
|---|---|
| Public site | http://localhost:3000 |
| Admin panel | http://localhost:3001 |
| API + docs | http://localhost:8000/api/docs/ |
| Health | http://localhost:8000/api/health/ |

`docker compose up` runs migrations and seeds four ROI plans, five MLM levels,
three issuers, five instruments and four payment channels. Create the first
administrator:

```bash
docker compose exec api python manage.py seed_platform \
  --admin-email you@example.com --admin-password 'a-strong-password'
```

### Local development (no Docker)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env      # set DATABASE_URL=sqlite:///db.sqlite3 for a quick start
python manage.py migrate
python manage.py seed_platform --admin-email you@example.com --admin-password 'password'
python manage.py runserver          # http://localhost:8000

cd ../frontend/user-app  && npm install && npm run dev    # :3000
cd ../frontend/admin-app && npm install && npm run dev    # :3001
```

The ROI sweep and price ticker need Celery. Without Docker, run them in
separate terminals — or use **Admin → ROI plans → Run payouts now**, which does
the same sweep on demand.

```bash
celery -A config worker -l info
celery -A config beat   -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

## Opening an account

Registration is one request, not two. The signup form collects the member's
details and **all five identity documents** — ID front, ID back, selfie, proof
of address and bank proof — and the API refuses a signup missing any of them.
The account and its documents are written in the same transaction, so nobody
can exist on the platform without something for an administrator to verify them
by.

Each document is then reviewed on its own from **Admin → KYC**. A member reads
as `approved` only once every one of theirs has been; a single rejection marks
them `rejected` and the reason is shown back to them. Their own dashboard
carries the same panel, document by document, so they can see exactly what the
desk is holding.

## What the desk can do to an account

Each row in **Admin → Users** carries a menu: add funds, take funds out, set the
balance to a figure, change the password, block, and close.

Every money action writes one `Transaction` with a required reason, so it lands
on the member's own statement rather than appearing from nowhere. **Set balance**
posts the destination, not a difference worked out in the browser — the API
computes the delta under a row lock, so a payout arriving between reading the
screen and pressing the button is not overwritten.

**Closing an account archives it.** Sign-in is refused and it drops out of the
member list, but its deposits, payouts and the commission it generated for its
upline stay in the books; deleting the row would take somebody else's earnings
with it and leave the ledger unable to explain itself. It is reversible, and
`?status=archived` finds it again.

Passwords are set without asking for the old one — the point is that somebody
lost access — but Django's validators still run against the target's own
details, and an administrator cannot reset another administrator's password
unless they are a super-admin.

## Talking to the desk

Members write from a floating chat widget or the **Support** page — the same
thread either way, because a thread *is* every message carrying that member's
id, so the two views cannot disagree. Administrators answer from **Admin →
Messages**, which lists one row per member who has written in, filters by name
or email, and filters an open conversation by date range.

Clicking a message opens its menu: reply with a quote, react, forward, copy,
star, edit and delete. Replies carry a tappable quote of what they answer, and
a quote lifted from another thread is dropped rather than rendered — the strip
shows its text verbatim. Reactions come from the full emoji set — six on the quick row, the rest behind a searchable picker that is also on the compose box — and are one per person, so a second choice
replaces the first. Stars are per side, so the desk and the member can each
mark what matters to them without clearing the other's. Editing is limited to
your own words and only until the other side has read them.

Deleting is asymmetric on purpose. A member may remove their own messages but
never the reply they were given; an administrator may remove any message, or
clear a whole conversation, and both are written to the audit log.

## How money moves

```
Member files deposit  ──►  status: pending      (nothing credited)
        │                  cash requires a written description of the handover
        ▼
Admin approves        ──►  ┌ wallet credited + ledger row
                           ├ auto-invested into the matching slab   (setting)
                           └ upline paid deposit commission, level by level
        ▼
Hourly Celery sweep   ──►  for each investment, for each month now due:
                           ├ credit that month's percentage of the principal
                           ├ write a RoiPayout (unique per investment+month)
                           └ pay the upline their ROI override
        ▼
Term completes        ──►  investment matures, principal returned to wallet
```

Every step is **idempotent**. `RoiPayout` is unique on `(investment, month)` and
`Commission` on `(earner, trigger, reference_id)`, so a retried task, a
double-clicked approve button, or two overlapping sweeps all converge on exactly
one payment. A worker that is down for six weeks catches up in order on its next
run rather than paying only the latest month.

Withdrawals debit the wallet **at request time**, not at approval — otherwise a
member could queue five withdrawals of their whole balance and have all five
approved. A rejection refunds the hold.

## Layout

```
backend/
  config/            settings, urls, asgi (WebSocket), celery schedules
  apps/core/         SystemSetting, Notification, AuditLog, permissions, seed command
  apps/accounts/     User (= MLM tree node via `sponsor`), Referral, KYC, tree queries
  apps/instruments/  Issuer, Instrument, PriceTick, live-price consumer + ticker
  apps/investments/  RoiPlan, RoiPlanMonth, Investment, RoiPayout, the payout runner
  apps/wallet/       PaymentChannel, Deposit, Withdrawal, Transaction, verification
  apps/mlm/          MlmLevelConfig, Commission, the chain-walking engine
  apps/support/      SupportMessage — one thread per member, and the desk's inbox
frontend/user-app/   Next.js 15 — landing board, calculator, wallet, network tree
frontend/admin-app/  Next.js 15 — verification queues, KYC desk, support inbox, plans
nginx/               reverse proxy: admin.* → admin app, everything else → user app
```

### Design notes

- **Users *are* the tree.** There is no separate "partner" table — `User.sponsor`
  is the single edge, and the downline is read with one recursive CTE rather than
  a query per level.
- **UUID primary keys** throughout, so referral links and admin URLs leak no row
  counts.
- **Append-only ledger.** Every balance change writes one `Transaction` carrying
  the resulting balance, so statements reconcile without replaying history. The
  test suite asserts the ledger replays exactly to each stored balance.
- **Rounding is DOWN, per payout.** A 5% override on a 12.50 return is 0.62, not
  0.63 — the platform never pays out fractions of a cent more than it owes.
- **Row-locked writes.** Balance updates take `select_for_update` on the user, so
  two concurrent payouts to the same upline cannot both read a stale balance.

## Live prices

Instruments carry a `price_source`:

- `manual` — moves only when an admin publishes a price, which broadcasts to
  every open page immediately.
- `feed` — moved by the ticker task every `PRICE_TICK_SECONDS` and pushed over
  `ws://…/ws/prices/`.

> The bundled feed is a **bounded random walk, not market data**. It exists so
> the live-price path is demonstrably working end to end. Before going live,
> point `apps/instruments/services._next_price` at a real provider.

The landing page seeds from a REST snapshot, upgrades to the WebSocket, and falls
back to polling if the socket cannot be opened — so a proxy without upgrade
support degrades rather than showing a frozen board.

## Tests

```bash
cd backend && python manage.py test
```

83 tests. The money path (`apps.investments`) covers slab selection,
deposit-relative month maturity (including Jan 31 → Feb 28 clamping), direct and
indirect commission, qualification gating, idempotency of both the sweep and the
commission engine, withdrawal holds and refunds, tree assembly, and ledger
integrity. `apps.accounts` covers the signup gate — that a registration missing
any document creates no account at all, and that a member turns `approved` only
once every one of their documents has been. `apps.instruments` covers the price
feed and the WebSocket fan-out. `apps.support` covers the chat's asymmetric
delete rules — a member may remove their own words but not the answer they were
given — that one member's thread never leaks into another's, and the message
menu: quote scoping, one reaction per person, per-side stars and the edit
window.

## Before going live

- [ ] Set a real `SECRET_KEY`, `DEBUG=False`, and a specific `ALLOWED_HOSTS`
- [ ] Terminate TLS and redirect port 80 → 443
- [ ] Replace the seeded payment channels with your real accounts
- [ ] Replace the simulated price feed with a licensed data source
- [ ] Configure SMTP — email OTP models exist but no backend is wired up
- [ ] Set up `pg_dump` backups of the `pgdata` volume
- [ ] Review the referral percentages against your actual margin: the MLM page
      warns you if the levels sum past 100%, but only you know what the business
      can afford

### Not built

Email/SMS delivery (models and OTP table exist; no sending backend), two-factor
auth, payment-gateway integration (all methods are manually verified by design),
and rank/tier bonuses beyond the level structure.
