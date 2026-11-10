# Gym Tracker

> **Project specification and development reference**

Gym Tracker is a website and membership manager for **one gym in India**. Visitors see a public landing page, members sign in to see their own membership, and the owner manages the gym.

Payments are **offline**: the owner records cash, UPI, or card payments. Payment alerts are sent via **SMS (MSG91)** and **WhatsApp (Meta Cloud API)**.

## 1. Technology Stack

**Monorepo:** TypeScript with npm workspaces, running on **Node.js 20+**.

| Workspace | Stack | Purpose |
| --- | --- | --- |
| `apps/web` | React 18, Vite, Tailwind CSS 3, shadcn/ui, TanStack Query, React Router 6 | Public website, member portal, owner dashboard |
| `apps/api` | Express 4, PostgreSQL via `pg` (raw SQL, no ORM), Zod, `node-cron` | API, authentication, billing, notifications, scheduled jobs |
| `packages/shared` | Zod schemas, TypeScript types, constants, pure helpers | Shared contracts and utilities used by both apps |

## 2. Getting Started

Run these commands from the **repository root**:

```bash
npm install
cp apps/api/.env.example apps/api/.env
# Edit DATABASE_URL, JWT_SECRET, OWNER_EMAIL, and OWNER_PASSWORD.

npm run db:migrate
npm run db:seed
npm run dev
```

- `npm run db:migrate` is **idempotent** and also upgrades an old owner-only database.
- `npm run db:seed` creates or resets the owner login and creates a starter plan.
- `npm run dev` starts the API on **`:4000`** and the web app on **`:5173`**. Vite proxies `/api`, keeping the cookie same-origin.

### Validation, tests, and builds

```bash
npm run typecheck
npm test
npm run build
npm start
```

| Command | Behavior |
| --- | --- |
| `npm run typecheck` | Runs `tsc --noEmit` in every package. **Run before saying a change is done.** |
| `npm test` | Runs unit tests for `packages/shared` only. |
| `npm run build` | Builds the web app (typechecks, then runs Vite build), followed by the API (tsup). |
| `npm start` | Runs the built API, which also serves `apps/web/dist`. |

### Production migration and seeding

Use the production commands to run the built bundle **without `tsx`**:

```bash
npm run migrate:prod -w @gym/api
npm run seed:prod -w @gym/api
```

### Adding a shadcn/ui component

```bash
cd apps/web
npx shadcn@latest add <name>
```

## 3. Repository Layout

```text
packages/shared/src/
  constants.ts       # Roles, statuses, CSRF header
  types.ts           # Shared TypeScript types
  schemas.ts         # Shared Zod request schemas
  utils.ts           # Phone normalization, addMonths, opening hours

apps/api/src/
  config.ts          # Zod-validated environment; only process.env reader (except seed.ts)
  app.ts             # Routes mounted in public, member, and owner guard groups
  db/
    schema.ts        # Entire SQL schema
    pool.ts          # PostgreSQL pool and type parsers
    migrate.ts       # Migrations
    seed.ts          # Owner login and starter plan seeding
  middleware/
    auth.ts          # Cookie session and requireRole
    csrf.ts          # CSRF check
    error.ts         # Error handling
  routes/
    public
    auth
    me
    members
    plans
    offers
    website
    dashboard
    settings
    notifications
    jobs
  services/
    billing.ts       # Daily billing check
    scheduler.ts     # Scheduled tasks
    messaging/
      templates       # Notification templates
      sms             # MSG91 SMS sending
      whatsapp        # Meta Cloud API sending
      dedupe          # Deduplication and logging

apps/web/src/
  lib/
    api.ts           # Fetch client
    queries.ts       # ALL TanStack Query hooks
    queryClient.ts   # Query client and session cleanup
    roles.ts         # Role utilities
    format.ts        # Presentation formatting
  components/ui/     # shadcn components; source copied in and freely editable
  components/
    AppShell          # Role-aware navigation
    RequireRole      # Route protection
    dialogs           # Dialog components
    landing/          # Hours, OfferCard, PlanCard
  pages/
    Landing
    Login
    Activate
    admin/            # Owner pages
    member/           # Member pages
```

### Frontend routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Landing page; the same page for everyone |
| `/login` | Public | Sign-in |
| `/activate/:token` | Public | Account activation |
| `/admin/*` | Owner | Owner dashboard and management |
| `/me/*` | Member | Member's own information |
| `/app` | Authenticated | Redirects based on role |

---

## 4. Non-Negotiable Engineering Rules

### 4.1 Authentication and sessions

- The session uses an **HttpOnly**, **SameSite=Lax** cookie named `gym_session`, with a **12-hour** lifetime. The cookie is **Secure in production**.
- **Never** put a token in an API response body, `localStorage`, `sessionStorage`, or `document.cookie`.
- Every **non-GET** request to `/api` must send the header `X-Requested-With: gym-tracker` (`CSRF_HEADER` / `CSRF_VALUE` in shared). Otherwise, the API returns **403**.
- The web `api()` client sends this header and uses `credentials: 'include'`.
- The cookie holds **only the user ID**. `requireAuth` reads roles from the database on **every request**, so removing a role or setting `is_active = false` takes effect immediately. **Do not put roles in the JWT.**
- Sign-in accepts an **email address or mobile number**.
- Authentication failure messages are intentionally generic to prevent **account enumeration**.

### 4.2 Authorization and data isolation

`apps/api/src/app.ts` mounts routes in **three guard groups**:

| Group | Paths | Protection |
| --- | --- | --- |
| Public | `/api/public`, `/api/auth` | Public routes |
| Member | `/api/me` | `requireAuth` + `requireRole('member')` |
| Owner | All other API routes | `requireRole('owner')` |

**Every new route must be mounted in the correct group.** An unguarded route is a data leak.

- Member-facing endpoints use **explicit column lists**.
- **Never** use `SELECT *` from `member_overview` for a member.
- **Never** expose `members.notes`, which contains the owner's private notes.
- No member ID belongs in any `/api/me` URL; derive the member from `req.user.id`.
- `/api/public/landing` returns **only owner-published content**. Never add `owner_phone`, alert settings, or member information to that response.

### 4.3 Request validation and errors

- Request shapes belong in `packages/shared/src/schemas.ts` and are reused by the frontend and API.
- Validate request bodies in the API with `schema.parse(req.body)`.
- A `ZodError` becomes HTTP **400** with a `field: message` response.
- Throw `HttpError(status, message)` for application errors. Error messages are shown to users **verbatim**, so use plain language.
- **Express 4 does not automatically catch async handler errors.** Wrap async route handlers in `asyncHandler`.

### 4.4 Database and migrations

Main schema location: `apps/api/src/db/schema.ts`.

- The schema consists of **three SQL parts**—**identity**, **legacy upgrade**, and **core**—sent as one statement, making migration **atomic**.
- Migrations must remain **idempotent**, using constructs such as:

  ```sql
  CREATE ... IF NOT EXISTS;
  ADD COLUMN IF NOT EXISTS ...;
  ON CONFLICT DO NOTHING;
  ```

- Changing an existing column requires a **guarded upgrade step**, following `legacyUpgradeSql`, that does nothing once applied.
- `member_overview` is **dropped and recreated on every migration**. Edit its definition in the migration code, not directly in the database.
- PostgreSQL `DATE` columns arrive as `YYYY-MM-DD` strings (configured by the type parser in `pool.ts`). Compare using strings and `laterDate`; **never** compare these values via `new Date()`.
- PostgreSQL `NUMERIC` and `BIGINT` arrive as JavaScript numbers.
- All due-date logic must use **`app_today()`**, which uses **Asia/Kolkata**. Do not use `now()::date` or server-local dates.
- Keep `pool.on('error')`: Neon can close idle connections, and an unhandled pool error crashes the process.
- Deleting a member deletes the corresponding `users` row. Related members, subscriptions, payments, invites, and role links **cascade**.

### 4.5 Billing rules

**Next due date:**

```text
later of (current due date, payment date) + plan months
```

- Only the **most recent payment** can be undone; undoing it restores `previous_due_date`.
- Membership status comes from the database view and progresses as follows:

| Status | Meaning |
| --- | --- |
| `paid_up` | Paid up; not yet in the reminder window |
| `due_soon` | Within reminder days, **including today** |
| `overdue` | Past the due date, but still within the grace period |
| `missed` | Past the grace period |

- The daily billing check runs at **09:00 IST**.
- At `due_soon`, the daily check sends a **reminder**.
- At `missed`, the daily check sends a **member alert and owner alert**.

### 4.6 Messaging and notification deduplication

Channels: **MSG91 SMS** and **Meta Cloud API WhatsApp**.

- Notification deduplication key: **subscription + kind + channel + due date**.
- Failed sends are eligible for retry on the **next run**.
- `MESSAGING_DRY_RUN` defaults to **`true`**:
  - In dry-run mode, a `dry_run` row counts as handled.
  - In live mode, **only `sent`** counts as handled.
- Manual reminders with `force` **bypass deduplication**.
- `services/messaging/templates.ts` is the **single source of notification wording**.
- `vars` order determines the WhatsApp positional template variable order: `{{1}}`, `{{2}}`, etc. MSG91 receives variables **by name**.
- Changing notification wording requires re-registering the relevant **approved templates with MSG91 and Meta**.
- Phone numbers are stored as **`91XXXXXXXXXX`**, normalized using `normalizeIndianPhone`.
- The owner's `users.phone` is intentionally **`NULL`**. The owner alert destination comes from `settings.owner_phone`.

### 4.7 Frontend data access and cache management

- **All server access** goes through TanStack Query hooks in `apps/web/src/lib/queries.ts`.
- Query keys are defined in `qk`.
- Mutations use the internal `useRefreshAll`, which invalidates **everything except `['me']`**, because a mutation can affect multiple screens.
- Sign-out and **every 401** must end the session via `endSession(qc)`.
- **Do not call `queryClient.clear()`**. It detaches mounted observers, preventing the UI from redirecting to sign-in. This is a real bug caught during testing.
- Owner navigation links use the **`/admin`** prefix, and member links use **`/me`**.
- Both menus live in `AppShell`. A user with **both roles** sees both menus.

### 4.8 Styling, accessibility, and interaction

- Use **shadcn/ui components** and the CSS variables in `index.css`.
- Use `status-*` Tailwind tokens for **paid**, **due**, **late**, and **missed** states. **No hard-coded colors**.
- Fonts are bundled using **`@fontsource`**; **no CDN fonts**.
- Dark mode follows the **device/system preference** and is **never stored**.
- **No `window.confirm`**; use `ConfirmDialog`.
- Form errors belong in a paragraph with `role="alert"`.
- Non-urgent banners use `role="status"` (the shadcn `Alert` component defaults to `alert`).
- Every input must have a `Label` with a matching `htmlFor`.

---

## 5. Development Recipes

### 5.1 Add a new owner page

1. Create the component in `apps/web/src/pages/admin/`.
2. Add the route in `App.tsx` under the **owner `RequireRole`**.
3. Add its navigation entry to **`OWNER_NAV`** in `AppShell`.
4. Add the necessary hooks to `apps/web/src/lib/queries.ts`.
5. Add the API route file and mount it in the **owner group** of `app.ts`.

### 5.2 Add a new role

1. Insert the new role into `roles` and update the **seed list** in `schema.ts`.
2. Add the role key to `ROLE_KEYS` in shared.
3. Assign it to users through `user_roles`.
4. Protect routes using `requireRole(...)`.
5. Add the corresponding frontend pages and menu.

### 5.3 Add a setting or profile field

1. Add the database column with **`ADD COLUMN IF NOT EXISTS`** in `coreSql`.
2. Update the shared **type** and **Zod schema**.
3. Update the API route.
4. Update the frontend form.

### 5.4 Add a message type

1. Add the kind to `NOTIFICATION_KINDS`.
2. Add its template to `TEMPLATES`.
3. Add template environment variables to `config.ts`.
4. Update `billing.ts`.
5. Update the `notifications.kind` **CHECK constraint** with a guarded `ALTER`; the original constraint lives in `CREATE TABLE`, which does not modify an existing table.

---

## 6. Testing and Verification

### Existing committed tests

- `packages/shared/test`: phone normalization, month arithmetic, opening hours, and schemas.
- There are **no committed API or UI tests**.

### API behavior tests

1. Build the API.
2. Run it against a **throwaway PostgreSQL database**.
3. Exercise endpoints with `curl`, using a **cookie jar** and the required `X-Requested-With` header.

### UI behavior tests

Use **Vitest + jsdom + Testing Library**, with a **cookie-jar wrapper around `fetch`**.

Polyfill the browser APIs needed by Radix:

```text
hasPointerCapture
setPointerCapture
releasePointerCapture
scrollIntoView
ResizeObserver
window.matchMedia
```

Additional requirements:

- Tests create data, so **reset the test database between runs**.
- Install all test packages in **one** `npm i --no-save -w @gym/web ...` command; a later install can prune the temporary packages.
- When one dialog hands off to another, **wait for the new dialog by its text**. Do not immediately query `role="dialog"` after clicking.

### Not yet verified

The following have **never been verified**:

- Live SMS sending through MSG91.
- Live WhatsApp sending through Meta Cloud API.
- A real Neon database.
- Visual layout in an actual browser.

Do not claim these are verified without performing the relevant checks.

---

## 7. Environment and Deployment

- Example environment file: **`apps/api/.env.example`**.
- Actual secrets go in **`apps/api/.env`**, which is **git-ignored**.
- `config.ts` is the only source file that reads `process.env`, **except `seed.ts`**.
- In `NODE_ENV=production`, startup refuses to proceed without a **`JWT_SECRET` of at least 32 characters**.
- Production requires **HTTPS** because the session cookie is Secure.
- Set **`COOKIE_SECURE=false` only when serving over plain HTTP**.
- Behind a reverse proxy, set **`TRUST_PROXY=true`**.
- Set **`CORS_ORIGIN` only when the web app runs on a different origin**.
- For **Neon PostgreSQL**, use `sslmode=verify-full`; the pooled hostname is supported.
- Run **one scheduler instance only**. Set `RUN_SCHEDULER=false` on any additional application instances.

### Environment values to configure first

```dotenv
DATABASE_URL=
JWT_SECRET=
OWNER_EMAIL=
OWNER_PASSWORD=
```

Refer to `apps/api/.env.example` for the complete set of environment variables, including messaging templates and deployment options. Do not commit real credentials.

---

## 8. Known Limits — Do Not Change Without Asking

These are intentional product constraints, **not bugs to fix automatically**:

1. **Single gym, single owner login.**
2. **No online payments.** The owner records cash, UPI, and card transactions offline.
3. **No self-service forgot-password flow.** The owner can create a new invite link; `db:seed` resets the owner login.
4. **Opening-hour slots cannot cross midnight.**
5. **Month-end due dates follow PostgreSQL's date arithmetic.** For example, January 31 + one month becomes February 28 (in a non-leap year); successive due dates can therefore drift earlier after a short month.

---

## 9. Change Completion Checklist

Before marking a change complete, confirm:

- [ ] The route is mounted in the correct **public/member/owner guard group**.
- [ ] Authentication, CSRF, and data-visibility rules remain intact.
- [ ] Request validation uses the **shared Zod schema**.
- [ ] Any schema migration is **atomic, idempotent, and backward-compatible** as required.
- [ ] Date logic uses **Asia/Kolkata** and the established string/date helpers.
- [ ] Query hooks and invalidation follow `queries.ts`, `qk`, and `useRefreshAll` conventions.
- [ ] UI uses the established design tokens and accessibility patterns.
- [ ] Notification templates, deduplication, and dry-run behavior remain consistent.
- [ ] `npm run typecheck` passes.
- [ ] Relevant tests and builds have been run; unverified behavior is clearly identified.

> **Project principle:** Preserve the specified security, data-isolation, billing, and deployment invariants. Do not expand intentionally limited scope without explicit approval.
