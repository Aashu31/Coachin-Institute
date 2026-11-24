import { Router } from 'express';
import { z } from 'zod';

import { createDemoLead } from '../services/lead.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validationError } from '../utils/errors.js';

export const leadRouter = Router();

const demoLeadSchema = z.object({
  studentName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(10).max(20),
  targetCourse: z.enum(['CAT', 'CLASS_12_PCM']),
  preferredSlot: z.enum(['MORNING', 'EVENING', 'WEEKEND']),
  notes: z.string().trim().max(500).optional(),
  instituteSlug: z.string().trim().min(1).max(100).optional(),
});

/**
 * Public endpoint used by the P.D.O Classes landing page. No JWT is required,
 * but the write is still executed inside a tenant-scoped RLS transaction.
 */
leadRouter.post(
  '/demo',
  asyncHandler(async (req, res) => {
    const parsed = demoLeadSchema.safeParse(req.body);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const result = await createDemoLead(parsed.data);
    res.status(201).json({ success: true, data: result });
  }),
);
