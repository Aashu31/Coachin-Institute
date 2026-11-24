import { Router } from 'express';

import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { requireAuthContext, requireTenantDb } from '../types/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const healthRouter = Router();

interface DatabaseClockRow {
  database_time: string;
}

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const startedAt = Date.now();
    const result = await pool.query<DatabaseClockRow>(
      "SELECT to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS database_time",
    );

    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        service: 'pdo-classes-api',
        version: '1.0.0',
        environment: env.NODE_ENV,
        timezone: env.APP_TIMEZONE,
        database: 'connected',
        databaseTime: result.rows[0]?.database_time ?? null,
        latencyMs: Date.now() - startedAt,
        uptimeSeconds: Math.round(process.uptime()),
      },
    });
  }),
);

interface TenantScopeRow {
  institute_id: string | null;
  database_role: string;
  visible_students: number;
  visible_batches: number;
}

/**
 * Proves the RLS contract end-to-end: the transaction-scoped GUC, the policy
 * filter and the row counts all come from the same connection.
 */
export const tenantHealthHandler = asyncHandler(async (req, res) => {
  const auth = requireAuthContext(req.auth);
  const db = requireTenantDb(req.db);

  const result = await db.query<TenantScopeRow>(
    `SELECT
        current_setting('app.current_institute_id', TRUE) AS institute_id,
        current_user AS database_role,
        (SELECT COUNT(*)::int FROM students WHERE institute_id = $1) AS visible_students,
        (SELECT COUNT(*)::int FROM batches WHERE institute_id = $1) AS visible_batches`,
    [auth.instituteId],
  );

  const scope = result.rows[0];

  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      rlsActive: scope?.institute_id === auth.instituteId,
      databaseRole: scope?.database_role ?? null,
      instituteId: auth.instituteId,
      visibleStudents: scope?.visible_students ?? 0,
      visibleBatches: scope?.visible_batches ?? 0,
    },
  });
});
