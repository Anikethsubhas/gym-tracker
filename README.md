# Gym Tracker

A gym website and membership manager. Visitors see a public landing page, **members** sign in to see their own membership, and the **owner** runs everything. Payment alerts go out by **SMS (MSG91)** and **WhatsApp (Meta Cloud API)**.

A TypeScript monorepo (npm workspaces):

| Package | What it is |
|---|---|
| `apps/web` | React 18 + Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| `apps/api` | Node.js + Express + PostgreSQL, cookie sessions, daily alert scheduler |
| `packages/shared` | The zod schemas, types and helpers both apps import, so a request is validated by the same code on both sides |

## Who sees what

| | Visitor (not signed in) | Member | Owner |
|---|---|---|---|
| Landing page: gym details, offers, plans, opening hours | yes | yes | yes |
| Their own membership status, next due date, reminders, payments | | yes | |
| Offers and plans inside the app | | yes | |
| Members, payments, plans, offers, website, alerts, settings | | | yes |

Everyone sees the **same landing page** at `/`. After signing in, a member goes to `/me` and the owner to `/admin`. Everything on the landing page is set by the owner:

- **Gym details** (name, tagline, about, facilities, address, phone, email) and the **weekly opening hours** (several slots per day, for split shifts) are on the **Website** page.
- **Offers** (headline, details, code, start and end dates, on/off) are on the **Offers** page. An offer only shows while it is switched on and between its dates.
- **Plans** (price, length, what is included, "most popular") are on the **Plans** page. Active plans are listed on the landing page.

The landing page shows a live "Open now / Closed" sign worked out from the opening hours.

## Members signing in

Members sign in with their **mobile number or email** and a password they choose themselves:

1. The owner adds the member. The app offers to create a **sign-in link** straight away (or later from the member's page: *Invite to the app*).
2. The owner sends the link by WhatsApp (one click) or any other way.
3. The member opens it, chooses a password, and is signed in. The link works **once** and expires after **7 days**. Only a hash of it is stored.
4. A forgotten password is the same: the owner creates a new link (*Reset password link*).

Members can then change their password and email on the **Account** page. A member can only ever see their own data: there is no member id in any member URL, the member is always taken from the session, and the owner's private notes are never sent to them.

## Users and roles

```
users ──< user_roles >── roles
  │
  └── members ── subscriptions ── payments
```

| Table | Purpose |
|---|---|
| `users` | Anyone who can sign in: name, email, phone, password hash, active flag |
| `roles` | The kinds of user: `owner` and `member` today |
| `user_roles` | Which roles each user holds (a user can hold several) |
| `user_invites` | One-time password-setup links (hashed) |
| `members` | The gym side of a member: joined date and the owner's private notes. Each row points to a user |

A user's roles are read from the database on **every request**, so removing a role, or switching an account off (`users.is_active = false`), takes effect immediately.

### Adding a role later

1. Add a row: `INSERT INTO roles (key, name, description) VALUES ('trainer', 'Trainer', '...');` (also add it to the seed list at the top of `apps/api/src/db/schema.ts` so new databases get it).
2. Add the key to `ROLE_KEYS` in `packages/shared/src/constants.ts`.
3. Give it to people: `INSERT INTO user_roles (user_id, role_id) ...`.
4. Protect its routes with `requireRole('trainer')` in `apps/api/src/app.ts`, and add its pages to `apps/web/src/App.tsx` and a menu in `components/AppShell.tsx`.

## What the owner does

- **Members and plans.** Add members, assign a plan, pause, resume or cancel. Create any number of plans.
- **Offline payments.** Record cash / UPI / card payments. Each payment moves the next due date forward. The most recent payment can be undone.
- **Automatic alerts, every day at 9:00 AM IST:**

  | When | Who is messaged |
  |---|---|
  | Due date is 3 days away (or closer) | Member gets a payment reminder |
  | Still unpaid after the 3-day grace period | Member gets a missed-payment message **and** the owner gets an alert |

  Each message is sent once per due date, on both SMS and WhatsApp. A failed send is retried at the next daily check. Members see the reminders they received in their app.
- **Dashboard** with a "Needs attention" list, a **Messages** log with the exact wording and any provider error, and **Settings** for the reminder window, grace period and channels.

### Payment rules
- **Next due date** = the later of (current due date, payment date) + plan length. Paying early never loses days; paying late starts the new period on the payment date.
- **Status:** `paid up` → `due soon` (inside the reminder window, including due today) → `overdue` (past due, inside the grace period) → `missed` (past the grace period).
- All dates use India time (Asia/Kolkata).

## Quick start

You need Node.js 20+ and PostgreSQL 14+.

```bash
npm install

docker compose up -d                         # optional: a ready-made local PostgreSQL (skip it if you use Neon, see below)
cp apps/api/.env.example apps/api/.env       # then edit DATABASE_URL, JWT_SECRET, OWNER_EMAIL, OWNER_PASSWORD, GYM_NAME, OWNER_PHONE

npm run db:migrate                           # creates the tables and the owner and member roles
npm run db:seed                              # creates the owner login and a starter "Monthly" plan

npm run dev                                  # API on :4000, web on http://localhost:5173
```

Open http://localhost:5173 for the landing page, then **Member login**, and sign in as the owner with the `OWNER_EMAIL` / `OWNER_PASSWORD` from your `.env`. Re-run `npm run db:seed` any time to reset the owner's password. Then fill in the **Website**, **Plans** and **Offers** pages to build your landing page.

The app starts in **test mode** (`MESSAGING_DRY_RUN=true`): alerts are written to the Messages page but nothing is sent. Use **Send today's alerts now** on the dashboard to run the daily check on demand.

### Using Neon (or another hosted PostgreSQL) instead of Docker

Only `DATABASE_URL` in `apps/api/.env` changes. Nothing else in the app depends on Docker.

1. In the Neon dashboard open your project, click **Connect**, pick your branch, database and role, and copy the connection string. It looks like `postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require`.
2. Paste it as `DATABASE_URL`, and change `sslmode=require` to **`sslmode=verify-full`**. Neon's certificates are publicly trusted, so full verification works, and it avoids a deprecation warning from the `pg` driver.
3. If the connection fails with an error mentioning `channel_binding`, delete `&channel_binding=require` from the string.
4. Run `npm run db:migrate` and `npm run db:seed` as usual. They create the tables in the Neon database.

Notes:
- The pooled host (the one with `-pooler` in the name) is fine for the app: it only uses plain queries and transactions. If a migration ever misbehaves through the pooler, run it once with the direct connection string (same string without `-pooler`).
- Neon pauses an idle database, so the first request after a quiet spell can take a second or two. The API waits up to 15 seconds for the connection, and it reconnects automatically if Neon closes an idle one.
- Keep `.env` out of version control (it is already in `.gitignore`). It now holds your database password.

### Upgrading a database from the owner-only version

Just run `npm run db:migrate`. If it finds the old layout it converts it in one transaction (all or nothing): the old owner becomes a user with the owner role and **keeps their password**; each member's name, phone and email move onto a user with the member role (no password yet, so create their sign-in links); payments, notes and history are untouched. If two old members shared an email address, only the first keeps it. Running it again changes nothing. On a hosted database, take a backup first, as you would for any schema change.

### Scripts (run from the repo root)

| Command | What it does |
|---|---|
| `npm run dev` | API (tsx watch) and web (Vite) together |
| `npm run typecheck` | `tsc --noEmit` in every package |
| `npm test` | Unit tests for `packages/shared` |
| `npm run build` | Builds the web app, then bundles the API |
| `npm start` | Runs the built API, which also serves the built web app |

## How the session works

The signed-in session (owner or member) lives in an **HttpOnly cookie** (`gym_session`). Nothing is stored in `localStorage` or `sessionStorage`, and JavaScript on the page can never read the login, so an injected script cannot steal it.

- The cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` when `NODE_ENV=production`. It lasts 12 hours.
- The browser attaches it automatically (`credentials: 'include'`); the login response contains no token.
- Because cookies are sent automatically, every request that changes data must also carry an `X-Requested-With: gym-tracker` header, otherwise the API answers 403. A forged cross-site form post cannot add that header. This sits on top of `SameSite=Lax`.
- In development, Vite proxies `/api` to the API, so the browser sees one origin and the cookie works with no CORS. In production the API serves the built web app, so it is one origin again.
- Signing out calls `POST /api/auth/logout`, which clears the cookie. An expired or tampered cookie returns 401 and the app returns to the sign-in page.
- Sign-in and invite-link attempts are rate limited per IP.
- The cookie holds only who the person is. Their roles are checked against the database on every request, and each API area is guarded by role: members get a 403 from any owner endpoint.

If the web app is ever hosted on a different origin than the API, set `CORS_ORIGIN` to its URL (credentials are then allowed for that origin only) and serve both over HTTPS.

## Data fetching

All server data goes through **TanStack Query** (`apps/web/src/lib/queries.ts`): one hook per resource (`useDashboard`, `useMembers`, `useMember`, `usePlans`, ...) and one per change (`useRecordPayment`, `useUndoPayment`, ...). A successful change refreshes everything on screen, so a payment updates the member page, the list, the dashboard and the message log together. Data also refreshes when you return to the tab.

## UI

Tailwind with shadcn/ui components in `apps/web/src/components/ui`. The design tokens (colours, radius, dark mode) are CSS variables at the top of `apps/web/src/index.css`; the theme follows the device's light or dark setting. Fonts (Barlow) are bundled locally, with no calls to Google Fonts.

`apps/web/components.json` is set up for the shadcn CLI, so you can add more components:

```bash
cd apps/web && npx shadcn@latest add tooltip
```

## Turning on real SMS and WhatsApp

Both providers only deliver pre-approved templates, so there is some one-time setup. Register the three messages below, fill in `apps/api/.env`, then set `MESSAGING_DRY_RUN=false`.

### The three messages

| Key | Sent to | Variables, in this order |
|---|---|---|
| `reminder` | Member | `name`, `plan`, `gym`, `due_date`, `amount` |
| `missed_member` | Member | `name`, `gym`, `amount`, `due_date` |
| `missed_owner` | Owner | `name`, `phone`, `amount`, `due_date`, `days_overdue` |

Wording (also defined in `apps/api/src/services/messaging/templates.ts`; if you change it there, register the same text):

- **reminder:** `Hi {{name}}, your {{plan}} membership at {{gym}} is due on {{due_date}}. Amount: Rs.{{amount}}. Please pay at the front desk to keep your membership active.`
- **missed_member:** `Hi {{name}}, your membership payment of Rs.{{amount}} at {{gym}} was due on {{due_date}} and is still pending. Please pay at the front desk as soon as possible.`
- **missed_owner:** `Missed payment: {{name}} ({{phone}}) has not paid Rs.{{amount}} due on {{due_date}}. {{days_overdue}} days overdue.`

### SMS with MSG91
1. Complete DLT registration (sender ID and content templates) with your telecom operator. This is a TRAI requirement for SMS in India.
2. In MSG91, create a **Flow** for each message. Write variables with the **same names** as above, e.g. `Hi ##name##, your ##plan## membership at ##gym## ...`.
3. Put your auth key and the three flow template IDs in `.env` (`MSG91_AUTH_KEY`, `MSG91_TEMPLATE_REMINDER`, `MSG91_TEMPLATE_MISSED_MEMBER`, `MSG91_TEMPLATE_MISSED_OWNER`).

### WhatsApp with Meta Cloud API
1. Set up a WhatsApp Business account and a phone number in Meta Business Manager, and create a permanent access token (System User).
2. Create three **Utility** templates named `gym_payment_reminder`, `gym_payment_missed`, `gym_owner_missed_alert` (or choose your own names and set `WHATSAPP_TEMPLATE_*`). In each body use `{{1}}`, `{{2}}`, ... following the **variable order in the table above**. Language: English (`en`).
3. Put `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` in `.env`.
4. Templates must be approved by Meta before they can be sent.

If a send fails (wrong template ID, not approved, bad token), the reason shows on the Messages page and the daily check retries it.

> **Note:** the MSG91 and Meta requests follow their documented APIs and were checked against mocked responses, but they have not been run against live accounts. Do a first run with your own phone number as a member before relying on it.

## Running it for real (one server)

```bash
npm run build
npm run migrate:prod -w @gym/api            # once, and after upgrades
npm run seed:prod -w @gym/api               # once
NODE_ENV=production npm start               # serves the API and the built web app on one port
```

- Set `JWT_SECRET` to a random string of 32+ characters. The server refuses to start in production without one.
- Serve it over **HTTPS** (Caddy, nginx, or your host's TLS). The production cookie is `Secure`, so browsers will not keep it over plain HTTP. Behind a reverse proxy, also set `TRUST_PROXY=true`.
- Keep the process running with `pm2` or a systemd service. The daily alerts are sent by this process, so it must be up at 9:00 AM. If you run several copies, set `RUN_SCHEDULER=false` on all but one.
- Back up the PostgreSQL database regularly. It holds all your members and payment history.

## Project layout

```
apps/
  api/src/
    config.ts            env parsed and validated with zod
    db/                  schema.ts, migrate.ts, seed.ts, pool.ts
    middleware/          auth (cookie session, requireRole), csrf, error
    routes/              public (landing), auth (sign-in, invites), me (member), members, plans, offers, website, dashboard, settings, notifications, jobs
    services/            billing.ts (daily check), scheduler.ts, messaging/ (MSG91, WhatsApp, templates)
  web/src/
    lib/                 api.ts, queries.ts (TanStack Query hooks), format.ts
    components/ui/       shadcn/ui components
    components/          AppShell, PaymentDialog, MemberDialog, StatusBadge, ...
    pages/               Landing, Login, Activate  ·  admin/ (owner)  ·  member/ (Home, Payments, Offers, Account)
packages/
  shared/src/            schemas.ts (zod), types.ts, constants.ts, utils.ts
```

## Good to know
- There is no self-service "forgot password": the owner creates a new link for a member, and `npm run db:seed` resets the owner's password. (Emailing or texting reset links would need another approved message template.)
- Members cannot pay online. They pay at the front desk and the owner records it, as before.
- Opening hours are per day and cannot cross midnight (a slot like 10 PM to 2 AM must be split across two days).
- No staff or multi-branch support yet, though the roles tables are ready for it.
- The owner gets one alert per missed member. If many members go past grace at once, expect that many messages.
- Month-end dates follow PostgreSQL's rule (31 Jan + 1 month = 28 Feb), so a due date can drift to an earlier day of the month after a short month.
- In test mode, a "Test only" entry counts as already handled for that due date, so switching to live mode mid-cycle won't re-send for members already logged. Failed live sends are always retried.
