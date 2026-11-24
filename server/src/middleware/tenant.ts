import type { RequestHandler } from 'express';
import { z } from 'zod';

import { createTenantDb } from '../db/pool.js';
import { AppError } from '../utils/errors.js';

const instituteIdSchema = z.string().uuid();

/**
 * Establishes the tenant for the request. It does not touch the database
 * itself: it attaches a TenantDb whose every transaction starts with
 * `SET LOCAL app.current_institute_id`, so RLS is evaluated for that tenant even
 * on pooled connections.
 *
 * This middleware MUST run after authMiddleware.
 */
export const tenantContext: RequestHandler = (req, _res, next) => {
  const auth = req.auth;

  if (!auth) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'));
    return;
  }

  const parsedInstituteId = instituteIdSchema.safeParse(auth.instituteId);

  if (!parsedInstituteId.success) {
    next(
      new AppError(
        400,
        'INVALID_TENANT_ID',
        'The provided institute ID is invalid or inactive.',
      ),
    );
    return;
  }

  req.db = createTenantDb(parsedInstituteId.data);
  next();
};
