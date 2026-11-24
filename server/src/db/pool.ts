import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { TenantDb } from '../types/tenant.js';

function buildPool(connectionString: string): Pool {
  const isCloudHost = !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');
  const needsSsl = env.DATABASE_SSL || (env.NODE_ENV === 'production' && isCloudHost) || connectionString.includes('sslmode=');

  const instance = new Pool({
    connectionString,
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: false,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });

  instance.on('error', (error: Error) => {
    logger.error('Unexpected PostgreSQL pool error', { message: error.message });
  });

  return instance;
}

/**
 * Application pool. In every deployed environment this connects as `pdo_app`,
 * the non-owner role created by the migration, so RLS is actually enforced.
 */
export const pool = buildPool(env.DATABASE_URL);

/**
 * Owner pool used only by the migration runner and the seed. Never expose this
 * connection to request handlers: the owner bypasses RLS by design.
 */
export function createMigrationPool(): Pool {
  return buildPool(env.DATABASE_MIGRATION_URL ?? env.DATABASE_URL);
}

/**
 * Runs `work` inside a transaction that has `app.current_institute_id` set
 * transaction-locally (the parameterised equivalent of `SET LOCAL`).
 *
 * `set_config(..., true)` is used instead of string interpolation so a tenant
 * id can never be injected into SQL. The setting is discarded automatically on
 * COMMIT/ROLLBACK, preventing tenant bleed between pooled connections.
 */
export async function withTenantTransaction<T>(
  instituteId: string,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_institute_id', $1, TRUE)", [instituteId]);

    const result = await work(client);

    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      logger.error('Failed to roll back tenant transaction', {
        message: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      });
    }
    throw error;
  } finally {
    client.release();
  }
}

class TenantDbClient implements TenantDb {
  readonly instituteId: string;

  constructor(instituteId: string) {
    this.instituteId = instituteId;
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<T>> {
    return withTenantTransaction(this.instituteId, (client) =>
      client.query<T>(text, [...params]),
    );
  }

  transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    return withTenantTransaction(this.instituteId, work);
  }
}

export function createTenantDb(instituteId: string): TenantDb {
  return new TenantDbClient(instituteId);
}

export async function closePool(): Promise<void> {
  await pool.end();
}
