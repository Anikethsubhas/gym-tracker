import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { activateSchema, changePasswordSchema, loginSchema, normalizeIndianPhone, type InviteInfo } from '@gym/shared';
import { config } from '../config';
import { pool, selectOne, withTransaction } from '../db/pool';
import { asyncHandler, HttpError } from '../utils/http';
import { hashToken } from '../utils/tokens';
import { clearCookieOptions, loadAuthUser, requireAuth, sessionCookieOptions, signSession } from '../middleware/auth';
import type { Response } from 'express';

const router = Router();

const limiter = (limit: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Try again in 15 minutes.' },
  });
const loginLimiter = limiter(20);
const inviteLimiter = limiter(40);

// Compared against when no account matches, so "no such account" and "wrong password" take the same time.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const INVITE_GONE = 'This link has expired or was already used. Ask the gym for a new one.';

function startSession(res: Response, userId: number) {
  // The token goes into an HttpOnly cookie. It is never part of a response body.
  res.cookie(config.session.cookieName, signSession(userId), sessionCookieOptions);
}

/** People sign in with the email or the mobile number their account was created with. */
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { identifier, password } = loginSchema.parse(req.body);
  const byEmail = identifier.includes('@');
  const value = byEmail ? identifier.toLowerCase() : normalizeIndianPhone(identifier);

  const found = value
    ? await selectOne<{ id: number; password_hash: string | null; is_active: boolean }>(
        pool,
        `SELECT id, password_hash, is_active FROM users WHERE ${byEmail ? 'email' : 'phone'} = $1`,
        [value],
      )
    : undefined;

  const matches = await bcrypt.compare(password, found?.password_hash ?? DUMMY_HASH);
  if (!found || !found.password_hash || !found.is_active || !matches) {
    throw new HttpError(401, 'The email or mobile number, or the password, is incorrect.');
  }

  await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [found.id]);
  const user = await loadAuthUser(found.id);
  startSession(res, found.id);
  res.json({ user });
}));

router.post('/logout', (_req, res) => {
  res.clearCookie(config.session.cookieName, clearCookieOptions);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user);
});

router.post('/password', requireAuth, asyncHandler(async (req, res) => {
  const { current_password, new_password } = changePasswordSchema.parse(req.body);
  const row = await selectOne<{ password_hash: string | null }>(
    pool, 'SELECT password_hash FROM users WHERE id = $1', [req.user!.id],
  );
  if (!row?.password_hash || !(await bcrypt.compare(current_password, row.password_hash))) {
    throw new HttpError(400, 'current_password: that is not your current password.');
  }
  await pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
    await bcrypt.hash(new_password, 10), req.user!.id,
  ]);
  res.status(204).end();
}));

/* ---------- invite links: first-time password setup and password reset ---------- */

router.get('/invite/:token', inviteLimiter, asyncHandler(async (req, res) => {
  const row = await selectOne<{ name: string; has_password: boolean }>(
    pool,
    `SELECT u.name, (u.password_hash IS NOT NULL) AS has_password
       FROM user_invites i JOIN users u ON u.id = i.user_id
      WHERE i.token_hash = $1 AND i.used_at IS NULL AND i.expires_at > now() AND u.is_active`,
    [hashToken(req.params.token)],
  );
  if (!row) throw new HttpError(404, INVITE_GONE);
  const body: InviteInfo = { name: row.name, is_reset: row.has_password };
  res.json(body);
}));

router.post('/activate', inviteLimiter, asyncHandler(async (req, res) => {
  const { token, password } = activateSchema.parse(req.body);
  const hash = await bcrypt.hash(password, 10);

  const userId = await withTransaction(async (db) => {
    const invite = await selectOne<{ id: number; user_id: number }>(
      db,
      `SELECT i.id, i.user_id FROM user_invites i JOIN users u ON u.id = i.user_id
        WHERE i.token_hash = $1 AND i.used_at IS NULL AND i.expires_at > now() AND u.is_active
        FOR UPDATE OF i`,
      [hashToken(token)],
    );
    if (!invite) throw new HttpError(404, INVITE_GONE);
    await db.query('UPDATE users SET password_hash = $1, last_login_at = now(), updated_at = now() WHERE id = $2', [hash, invite.user_id]);
    await db.query('UPDATE user_invites SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [invite.user_id]);
    return invite.user_id;
  });

  const user = await loadAuthUser(userId);
  startSession(res, userId);
  res.json({ user });
}));

export default router;
