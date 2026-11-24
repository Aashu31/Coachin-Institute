import { Router } from 'express';
import { z } from 'zod';

import { getActiveEscalationTasks, resolveEscalationTask } from '../services/escalation.service.js';
import { requireAuthContext, requireTenantDb } from '../types/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validationError } from '../utils/errors.js';
import { roleGuard } from '../middleware/auth.js';

export const escalationRouter = Router();

// Only ADMIN and RECEPTIONIST can access escalation endpoints
escalationRouter.use(roleGuard('SUPER_ADMIN', 'INSTITUTE_ADMIN', 'RECEPTIONIST'));

const resolveSchema = z.object({
  taskId: z.string().uuid(),
  callOutcome: z.enum(['VERIFIED_SICK', 'BUNK_CONFIRMED', 'LINE_UNREACHABLE']),
  staffNotes: z.string().trim().min(1).max(500),
});

escalationRouter.get(
  '/tasks',
  asyncHandler(async (req, res) => {
    const db = requireTenantDb(req.db);

    const tasks = await getActiveEscalationTasks(db);

    res.status(200).json({ success: true, data: { tasks } });
  }),
);

escalationRouter.post(
  '/tasks/resolve',
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req.auth);
    const db = requireTenantDb(req.db);

    const parsed = resolveSchema.safeParse(req.body);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const task = await resolveEscalationTask(
      db,
      parsed.data.taskId,
      auth.userId,
      parsed.data.callOutcome,
      parsed.data.staffNotes,
    );

    res.status(200).json({ success: true, data: { task } });
  }),
);