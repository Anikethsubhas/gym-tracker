/**
 * The whole database schema, in three parts that always run in this order (`npm run db:migrate`).
 * Every part is safe to run repeatedly, and the three are sent as ONE statement, so an upgrade
 * either completes fully or changes nothing.
 */

/** 1. Who can sign in, and what they are allowed to be. */
export const identitySql = /* sql */ `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT,                        -- stored lower-case
  phone         TEXT,                        -- stored as 91XXXXXXXXXX
  password_hash TEXT,                        -- NULL until the person sets a password from an invite link
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_contact_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_key ON users (phone);

CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,          -- what the code checks, e.g. 'owner'
  name        TEXT NOT NULL,
  description TEXT
);
INSERT INTO roles (key, name, description) VALUES
  ('owner',  'Owner',  'Runs the gym: members, plans, offers, payments and settings.'),
  ('member', 'Member', 'A gym member: sees their own membership, reminders and offers.')
ON CONFLICT (key) DO NOTHING;

-- A user can hold any number of roles, so new roles later need no change to this table.
CREATE TABLE IF NOT EXISTS user_roles (
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     INT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS user_roles_role_idx ON user_roles (role_id);

-- One-time links the owner shares so a member can set their password (or reset a forgotten one).
-- Only a hash of the token is stored.
CREATE TABLE IF NOT EXISTS user_invites (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_invites_user_idx ON user_invites (user_id);
`;

/**
 * 2. Upgrade from the owner-only version: `owners` becomes users with the owner role, and each
 *    member's name / phone / email move onto a users row with the member role. Does nothing on a
 *    new database or one that was already upgraded.
 */
export const legacyUpgradeSql = /* sql */ `
DO $upgrade$
DECLARE
  r RECORD;
  new_user INT;
  owner_role INT;
  member_role INT;
  usable_email TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'members' AND column_name = 'name'
  ) THEN
    DROP VIEW IF EXISTS member_overview;
    SELECT id INTO owner_role  FROM roles WHERE key = 'owner';
    SELECT id INTO member_role FROM roles WHERE key = 'member';

    IF to_regclass('owners') IS NOT NULL THEN
      FOR r IN SELECT * FROM owners LOOP
        INSERT INTO users (name, email, password_hash) VALUES (r.name, lower(r.email), r.password_hash)
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
        RETURNING id INTO new_user;
        INSERT INTO user_roles (user_id, role_id) VALUES (new_user, owner_role) ON CONFLICT DO NOTHING;
      END LOOP;
      DROP TABLE owners;
    END IF;

    ALTER TABLE members ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
    FOR r IN SELECT * FROM members ORDER BY id LOOP
      usable_email := NULL;
      IF r.email IS NOT NULL AND r.email <> '' AND NOT EXISTS (SELECT 1 FROM users WHERE email = lower(r.email)) THEN
        usable_email := lower(r.email);
      END IF;
      INSERT INTO users (name, phone, email) VALUES (r.name, r.phone, usable_email) RETURNING id INTO new_user;
      INSERT INTO user_roles (user_id, role_id) VALUES (new_user, member_role);
      UPDATE members SET user_id = new_user WHERE id = r.id;
    END LOOP;
    ALTER TABLE members ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE members ADD CONSTRAINT members_user_id_key UNIQUE (user_id);
    ALTER TABLE members DROP COLUMN name, DROP COLUMN phone, DROP COLUMN email;
  END IF;
END
$upgrade$;
`;

/** 3. The gym itself: plans, members' subscriptions and payments, alerts, offers and opening hours. */
export const coreSql = /* sql */ `
-- "Today" in the gym's timezone. Every due-date calculation uses this,
-- so a member's status never depends on the server's clock zone.
CREATE OR REPLACE FUNCTION app_today() RETURNS date AS $$
  SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date
$$ LANGUAGE sql STABLE;

CREATE TABLE IF NOT EXISTS settings (
  id                   INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gym_name             TEXT NOT NULL DEFAULT 'My Gym',
  owner_phone          TEXT,
  reminder_days_before INT NOT NULL DEFAULT 3 CHECK (reminder_days_before BETWEEN 0 AND 30),
  grace_days           INT NOT NULL DEFAULT 3 CHECK (grace_days BETWEEN 0 AND 30),
  sms_enabled          BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled     BOOLEAN NOT NULL DEFAULT true,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- What the public landing page shows about the gym.
ALTER TABLE settings ADD COLUMN IF NOT EXISTS tagline       TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS about         TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS address       TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS contact_phone TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS facilities    TEXT[] NOT NULL DEFAULT '{}';
INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS plans (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  duration_months INT NOT NULL DEFAULT 1 CHECK (duration_months BETWEEN 1 AND 36),
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE plans ADD COLUMN IF NOT EXISTS features    TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

-- The gym-specific side of a person who is a member. Their identity (name, phone, email, password)
-- lives in users.
CREATE TABLE IF NOT EXISTS members (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  joined_on  DATE NOT NULL DEFAULT app_today(),
  notes      TEXT,                           -- the owner's private notes, never shown to the member
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id            SERIAL PRIMARY KEY,
  member_id     INT NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
  plan_id       INT NOT NULL REFERENCES plans(id),
  start_date    DATE NOT NULL,
  next_due_date DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id                SERIAL PRIMARY KEY,
  member_id         INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  subscription_id   INT REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_id           INT REFERENCES plans(id),
  amount            NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method            TEXT NOT NULL CHECK (method IN ('cash','upi','card','other')),
  paid_on           DATE NOT NULL,
  previous_due_date DATE,                   -- lets the owner undo a payment
  period_start      DATE,
  period_end        DATE,                   -- the new due date after this payment
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_member_idx ON payments (member_id, paid_on DESC, id DESC);
CREATE INDEX IF NOT EXISTS payments_paid_on_idx ON payments (paid_on);

CREATE TABLE IF NOT EXISTS notifications (
  id                SERIAL PRIMARY KEY,
  member_id         INT REFERENCES members(id) ON DELETE SET NULL,
  subscription_id   INT REFERENCES subscriptions(id) ON DELETE SET NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('reminder','missed_member','missed_owner')),
  channel           TEXT NOT NULL CHECK (channel IN ('sms','whatsapp')),
  recipient         TEXT NOT NULL,
  due_date          DATE,
  status            TEXT NOT NULL CHECK (status IN ('sent','failed','dry_run')),
  trigger           TEXT NOT NULL DEFAULT 'auto' CHECK (trigger IN ('auto','manual')),
  message_preview   TEXT,
  provider_response TEXT,
  error             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_dedupe_idx
  ON notifications (subscription_id, kind, channel, due_date);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON notifications (created_at DESC);

-- Offers the owner publishes. They appear on the landing page and in every member's app
-- while switched on and between their start and end dates.
CREATE TABLE IF NOT EXISTS offers (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  highlight   TEXT,                          -- the short headline, e.g. "20% off"
  description TEXT,
  code        TEXT,                          -- optional code to quote at the desk
  valid_from  DATE,
  valid_until DATE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_from <= valid_until)
);

-- Opening hours. A day can have several slots (morning and evening); a day with none is closed.
CREATE TABLE IF NOT EXISTS gym_hours (
  id          SERIAL PRIMARY KEY,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),   -- 1 = Monday ... 7 = Sunday
  opens_at    TIME NOT NULL,
  closes_at   TIME NOT NULL,
  label       TEXT,
  CHECK (opens_at < closes_at)
);
CREATE INDEX IF NOT EXISTS gym_hours_day_idx ON gym_hours (day_of_week, opens_at);

-- One row per member with the live payment status already worked out.
--   paid_up  : next due date is further away than the reminder window
--   due_soon : due within the reminder window (includes "due today")
--   overdue  : past the due date but still inside the grace period
--   missed   : past the due date + grace period
DROP VIEW IF EXISTS member_overview;
CREATE VIEW member_overview AS
SELECT
  m.id, m.user_id, u.name, u.phone, u.email, m.joined_on, m.notes,
  s.id AS subscription_id, s.plan_id,
  p.name AS plan_name, p.price AS plan_price, p.duration_months,
  s.start_date, s.next_due_date, s.status AS subscription_status,
  (s.next_due_date - app_today()) AS days_until_due,
  CASE
    WHEN s.status <> 'active' THEN s.status
    WHEN app_today() > s.next_due_date + st.grace_days THEN 'missed'
    WHEN app_today() > s.next_due_date THEN 'overdue'
    WHEN (s.next_due_date - app_today()) <= st.reminder_days_before THEN 'due_soon'
    ELSE 'paid_up'
  END AS payment_status
FROM members m
JOIN users u ON u.id = m.user_id
JOIN subscriptions s ON s.member_id = m.id
JOIN plans p ON p.id = s.plan_id
CROSS JOIN settings st;
`;

export const fullSchemaSql = [identitySql, legacyUpgradeSql, coreSql].join('\n');
