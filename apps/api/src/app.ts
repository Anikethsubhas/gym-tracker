import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config';
import { requireAuth, requireRole } from './middleware/auth';
import { csrfGuard } from './middleware/csrf';
import { errorHandler, notFound } from './middleware/error';
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import jobRoutes from './routes/jobs';
import meRoutes from './routes/me';
import memberRoutes from './routes/members';
import notificationRoutes from './routes/notifications';
import offerRoutes from './routes/offers';
import planRoutes from './routes/plans';
import publicRoutes from './routes/public';
import settingsRoutes from './routes/settings';
import websiteRoutes from './routes/website';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(helmet());
  // Only needed when the web app is on a different origin. The default setup (Vite proxy in dev,
  // this server serving the built app in production) is same-origin and needs no CORS at all.
  if (config.corsOrigin) app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', csrfGuard);

  // Open to everyone: the landing page content, and signing in.
  app.use('/api/public', publicRoutes);
  app.use('/api/auth', authRoutes);

  // Members: only their own membership.
  app.use('/api/me', requireAuth, requireRole('member'), meRoutes);

  // Owner: running the gym. Signed in AND holding the owner role.
  const owner = [requireAuth, requireRole('owner')];
  app.use('/api/members', ...owner, memberRoutes);
  app.use('/api/plans', ...owner, planRoutes);
  app.use('/api/offers', ...owner, offerRoutes);
  app.use('/api/website', ...owner, websiteRoutes);
  app.use('/api/dashboard', ...owner, dashboardRoutes);
  app.use('/api/settings', ...owner, settingsRoutes);
  app.use('/api/notifications', ...owner, notificationRoutes);
  app.use('/api/jobs', ...owner, jobRoutes);
  app.use('/api', notFound);

  // In production this server also serves the built web app (apps/web/dist).
  const here = dirname(fileURLToPath(import.meta.url));
  const dist = join(here, '../../web/dist');
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
