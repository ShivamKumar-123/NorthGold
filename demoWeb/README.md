# NorthGold — demo build

The whole platform as a single Vite + React app, with **no backend**. Every rule
the Django services enforce runs in the browser and the database lives in
`localStorage`.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
npm run preview    # serve the built app on :4173
```

## Sign in

| Role | Email | Password |
| --- | --- | --- |
| Member | `priya@northgold.demo` | `demo1234` |
| Admin | `admin@northgold.demo` | `admin123` |

Both sign-in screens carry a "click to fill" button, so nobody has to find this
file first. Every seeded member uses `demo1234`:
`priya`, `arjun`, `rahul`, `sneha`, `neha`, `vikram`, `anita` — all
`@northgold.demo`. The admin panel is at `/admin`.

**The administrator is not a member.** It has no wallet, no deposits and no
network of its own, so signing in as the admin and opening a member screen would
show nothing but zeros — which is why a staff account is sent to the panel
instead. To see a member's money either open their row in **Users & network**,
or sign in as them.

**Reset the data** from the admin sidebar or Settings. That reseeds from
scratch, which is also what happens automatically if the stored shape is from
an older version.

## What actually runs here

`src/lib/store.ts` is the backend. It is not a set of canned fixtures — the
seed **replays real actions** (deposit → approve → auto-invest → cascade
commission → run every payout that has since fallen due), so the ledger adds up
and every screen agrees with every other screen.

- **Slab-matched plans.** An amount picks exactly one tier; the top one is
  open-ended.
- **Schedules frozen at purchase.** An investment copies the plan's month curve
  when it opens, so editing a plan in the admin panel changes what *future*
  investments are promised and never touches an existing one.
- **Cash deposits are verified.** Nothing moves until an administrator approves
  the request against the member's own description of the handover.
- **Support chat is real.** The floating bubble and the Support page share one
  thread; the admin panel's Messages screen answers it, filters by member and
  by date, and can delete a message or a whole conversation. Members can delete
  their own messages but not the replies they were given.

  Two tabs of the same browser now stay in step — a write in one drops the
  other's cached copy and both re-read. Two *different browsers* cannot: the
  database is this browser's `localStorage`, so Chrome and Edge are two
  separate databases and a message sent in one will never reach the other. To
  try both sides, use two tabs, or sign out and back in as the other account.
  The Django build is what puts one shared database under both sides.
- **KYC is part of opening an account.** Signup is two steps, and the second
  one will not submit without all five identity documents. They land in the
  admin KYC desk immediately; the member watches them clear on their own
  dashboard. Approval is per document — the account reads as verified only once
  every one of them has been approved.
- **Withdrawals hold funds at request time**, not at approval — otherwise the
  same balance could be promised to two pending requests. Rejecting returns it.
- **Commission walks the upline** level by level, honouring each level's
  `min_directs` unlock rule, and records the skipped ones with a reason so the
  ledger explains itself.
- **Money rounds DOWN at every payout.** Rounding half-up would, across twelve
  months and five levels, quietly pay out more than the schedule promises.
- **Payouts catch up on load.** There is no scheduler, so "time passing" is
  settled by checking every schedule against the clock whenever the app opens.
  It is idempotent — `months_paid` is the cursor.

`src/lib/queries.ts` sits between the store and the screens. The pages were
written against REST payloads in the production build, so this assembles the
same shapes out of the store; the markup, field names and empty states carried
over untouched.

## What is deliberately not production-grade

**Passwords are stored in plain text and every check runs client-side.** Anyone
can open devtools and grant themselves a balance. That is fine for a demo whose
entire database is already in the reader's own `localStorage` — there is nothing
here to protect. It is not fine for anything real.

Two other shortcuts worth knowing about:

- **Uploads are not kept.** Deposit proofs and KYC documents record the file
  *name* only. Base64 blobs would exhaust the ~5 MB storage quota after a
  handful of receipts, and there is no server to hold them.
- **The contact form composes, it does not post.** There is no enquiry inbox, so
  it assembles the fields into a message and hands off to WhatsApp or email —
  the same desk the rest of the site points at.

## Differences from the Django build

| | Production | This demo |
| --- | --- | --- |
| Data | PostgreSQL + DRF | `localStorage` |
| Admin | Separate Next app on `:3001` | `/admin` routes in the same app |
| Support chat | Polled against the API | reads straight from the store |
| KYC files | Uploaded and stored under `/media` | the file *name* only |
| Prices | WebSocket feed | a timer nudging the feed-priced rows ±0.4% |
| Payouts | Celery beat | caught up on app load |
| Instruments | Browsable list + detail pages | the landing board only |

Everything else — the design system, the GSAP and Framer Motion choreography,
light/dark, the payment-card wallet tiles, the referral graph — is the same code.

## Deploying to Vercel

This app is a subdirectory of a larger repository, so the import needs one
setting changed: **Root Directory → `demoWeb`**. Everything else is detected.

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Root directory | `demoWeb` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |
| Environment variables | none — there is no backend |

`vercel.json` rewrites everything to `index.html`. Without it a deep link like
`/admin/deposits` would 404 on refresh: the router lives in the browser, and
the server has no such path to serve. The catch-all is safe because Vercel
checks the filesystem *before* applying rewrites, so real assets are still
served as themselves.
