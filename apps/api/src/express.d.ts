import type { AuthUser } from '@gym/shared';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth once the session cookie is verified and the user's roles are loaded. */
      user?: AuthUser;
    }
  }
}
export {};
