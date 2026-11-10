import cron from 'node-cron';
import { config } from '../config';
import { runDailyChecks } from './billing';

export function startScheduler(): void {
  if (!cron.validate(config.cronSchedule)) {
    throw new Error(`CRON_SCHEDULE "${config.cronSchedule}" is not a valid cron expression.`);
  }
  cron.schedule(
    config.cronSchedule,
    () => {
      runDailyChecks('auto').catch((err) => console.error('[billing] failed:', err));
    },
    { timezone: config.timezone },
  );
  console.log(`[scheduler] daily check at "${config.cronSchedule}" (${config.timezone}).`);
}
