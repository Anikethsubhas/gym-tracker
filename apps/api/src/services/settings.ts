import type { SettingsRow } from '@gym/shared';
import { pool, selectOne } from '../db/pool';

export async function getSettings(): Promise<SettingsRow> {
  const row = await selectOne<SettingsRow>(pool, 'SELECT * FROM settings WHERE id = 1');
  if (!row) throw new Error('Settings row is missing. Run `npm run db:migrate`.');
  return row;
}
