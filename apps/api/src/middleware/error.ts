import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/http';

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found.' });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const field = first.path.join('.') || 'request';
    res.status(400).json({ error: `${field}: ${first.message}` });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  const code = (err as { code?: string }).code;
  if (code === '23505') {
    const constraint = (err as { constraint?: string }).constraint;
    const message =
      constraint === 'users_email_key'
        ? 'Another account already uses this email address.'
        : constraint === 'users_phone_key'
          ? 'A member with this phone number already exists.'
          : 'That value is already in use.';
    res.status(409).json({ error: message });
    return;
  }
  if (code === '23503') {
    res.status(409).json({ error: 'This record is still in use by something else.' });
    return;
  }
  if (code === '22007' || code === '22008') {
    res.status(400).json({ error: 'That date is not valid.' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
}
