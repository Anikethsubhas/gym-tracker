import type { CookieOptions, NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthUser, RoleKey } from '@gym/shared';
import { config } from '../config';
import { pool, selectOne } from '../db/pool';

const { cookieName, seconds, secure } = config.session;

/**
 * The session lives in an HttpOnly cookie: JavaScript in the page can never read it,
 * so a script injected into the app cannot steal the login.
 * SameSite=Lax stops other sites from making the browser send it on cross-site POSTs.
 */
const baseOptions: CookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/' };
export const sessionCookieOptions: CookieOptions = { ...baseOptions, maxAge: seconds * 1000 };
export const clearCookieOptions: CookieOptions = baseOptions;

/** The cookie holds only who the person is. Their roles are read fresh on every request. */
export function signSession(userId: number): string {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: seconds });
}

export async function loadAuthUser(userId: number): Promise<AuthUser | undefined> {
  const row = await selectOne<AuthUser & { is_active: boolean }>(
    pool,
    `SELECT u.id, u.name, u.email, u.phone, u.is_active,
            COALESCE(array_agg(r.key ORDER BY r.key) FILTER (WHERE r.key IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
      GROUP BY u.id`,
    [userId],
  );
  if (!row || !row.is_active) return undefined;
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, roles: row.roles };
}

function reject(res: Response, message: string) {
  res.clearCookie(cookieName, clearCookieOptions);
  res.status(401).json({ error: message });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[cookieName] as string | undefined;
  if (!token) {
    res.status(401).json({ error: 'Please sign in.' });
    return;
  }
  let userId: number;
  try {
    userId = Number((jwt.verify(token, config.jwtSecret) as jwt.JwtPayload).sub);
  } catch {
    reject(res, 'Your session has expired. Please sign in again.');
    return;
  }
  try {
    // Looked up every time, so removing a role or switching an account off takes effect immediately.
    const user = await loadAuthUser(userId);
    if (!user) {
      reject(res, 'Please sign in again.');
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Allows the request through when the signed-in user holds at least one of the given roles. */
export const requireRole =
  (...keys: RoleKey[]): RequestHandler =>
  (req, res, next) => {
    const roles = req.user?.roles ?? [];
    if (keys.some((key) => roles.includes(key))) {
      next();
      return;
    }
    res.status(403).json({ error: 'You do not have access to this.' });
  };
