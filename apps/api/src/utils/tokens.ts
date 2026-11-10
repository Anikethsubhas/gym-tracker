import { createHash, randomBytes } from 'node:crypto';

/** A random, URL-safe token to put in an invite link. */
export const newToken = (): string => randomBytes(32).toString('base64url');

/** Only this hash is stored, so a copy of the database cannot be used to sign anyone in. */
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
