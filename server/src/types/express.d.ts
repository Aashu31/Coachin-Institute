import type { AuthContext } from './domain.js';
import type { TenantDb } from './tenant.js';

declare global {
  namespace Express {
    interface Request {
      /** Populated by authMiddleware after a valid Bearer token is verified. */
      auth?: AuthContext;
      /** Populated by tenantContext; every query runs with RLS context set. */
      db?: TenantDb;
    }
  }
}

export {};
