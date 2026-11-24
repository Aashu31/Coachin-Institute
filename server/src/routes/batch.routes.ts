import { Router } from 'express';
import { z } from 'zod';

import { getBatchRoster, listBatches } from '../services/batch.service.js';
import { requireAuthContext, requireTenantDb } from '../types/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validationError } from '../utils/errors.js';

export const batchRouter = Router();

const batchIdSchema = z.string().uuid();

batchRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req.auth);
    const db = requireTenantDb(req.db);

    const result = await listBatches(db, auth);
    res.status(200).json({ success: true, data: result });
  }),
);

batchRouter.get(
  '/:id/students',
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req.auth);
    const db = requireTenantDb(req.db);

    const parsed = batchIdSchema.safeParse(req.params.id);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const result = await getBatchRoster(db, auth, parsed.data);
    res.status(200).json({ success: true, data: result });
  }),
);
