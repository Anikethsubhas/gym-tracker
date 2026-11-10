import type { NextFunction, Request, Response } from 'express';
import { CSRF_HEADER, CSRF_VALUE } from '@gym/shared';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Because the session is a cookie, every request that changes data must also carry a
 * custom header. A browser will not add a custom header to a cross-site form post,
 * and cross-site fetches need CORS approval first, so forged requests are rejected.
 * (This is on top of SameSite=Lax on the cookie itself.)
 */
export function csrfGuard(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method) || req.get(CSRF_HEADER) === CSRF_VALUE) {
    next();
    return;
  }
  res.status(403).json({ error: 'Request blocked.' });
}
