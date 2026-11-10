import pg from 'pg';
import { config } from '../config';

// Return DATE columns as plain 'YYYY-MM-DD' strings (no timezone shifting),
// NUMERIC and BIGINT as JS numbers.
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1700, (v) => parseFloat(v));
pg.types.setTypeParser(20, (v) => parseInt(v, 10));

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  // Managed databases such as Neon pause when idle; the first query after a pause can take a couple of
  // seconds. Fail with a clear error after 15s instead of hanging forever.
  connectionTimeoutMillis: 15_000,
  keepAlive: true,
});

// A managed database closes idle connections (for example when it scales to zero). pg reports that as an
// 'error' event on the pool, and Node exits the whole process if nobody is listening. The pool simply
// opens a fresh connection for the next query, so logging it is all that is needed.
pool.on('error', (err) => {
  console.warn('[db] an idle connection was closed by the server:', err.message);
});

/** Anything that can run a query: the pool, or a client inside a transaction. */
export interface Queryable {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(text: string, params?: unknown[]): Promise<pg.QueryResult<any>>;
}

export async function select<T>(db: Queryable, text: string, params: unknown[] = []): Promise<T[]> {
  const result = await db.query(text, params);
  return result.rows as T[];
}

export async function selectOne<T>(db: Queryable, text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await select<T>(db, text, params))[0];
}

export async function withTransaction<T>(fn: (db: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
