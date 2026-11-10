import { pool } from './pool';
import { fullSchemaSql } from './schema';

try {
  // One multi-statement query runs as a single transaction: all of it applies, or none of it.
  await pool.query(fullSchemaSql);
  console.log('Database schema is up to date.');
} catch (err) {
  console.error('Migration failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
