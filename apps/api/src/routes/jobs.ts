import { Router } from 'express';
import { asyncHandler } from '../utils/http';
import { runDailyChecks } from '../services/billing';

const router = Router();

// Runs the same check the scheduler runs every morning, on demand.
router.post('/run-checks', asyncHandler(async (_req, res) => {
  res.json(await runDailyChecks('manual'));
}));

export default router;
