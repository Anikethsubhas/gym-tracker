import type { AuthUser, RoleKey } from '@gym/shared';

export const hasRole = (user: AuthUser | null | undefined, role: RoleKey): boolean => Boolean(user?.roles.includes(role));

/** Where someone lands after signing in. A person who is both owner and member starts in the owner area. */
export function homePathFor(user: AuthUser | null | undefined): string {
  if (hasRole(user, 'owner')) return '/admin';
  if (hasRole(user, 'member')) return '/me';
  return '/';
}
