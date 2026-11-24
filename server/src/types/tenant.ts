import type { PoolClient, QueryResult, QueryResultRow } from 'pg';

import type { AuthContext } from './domain.js';

/**
 * Request-scoped database facade.
 *
 * `query()` executes one statement inside its own transaction with
 * `app.current_institute_id` set locally. `transaction()` lets a handler run
 * several statements atomically under the same tenant context.
 */
export interface TenantDb {
  readonly instituteId: string;
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<T>>;
  transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T>;
}

export function requireAuthContext(auth: AuthContext | undefined): AuthContext {
  if (!auth) {
    throw new Error('requireAuthContext() called before authMiddleware');
  }
  return auth;
}

export function requireTenantDb(db: TenantDb | undefined): TenantDb {
  if (!db) {
    throw new Error('requireTenantDb() called before tenantContext');
  }
  return db;
}
