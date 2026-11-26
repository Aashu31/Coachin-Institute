import { Router } from 'express';
import { z } from 'zod';

import { submitAttendance } from '../services/attendance.service.js';
import { requireAuthContext, requireTenantDb } from '../types/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validationError } from '../utils/errors.js';
import { AppError } from '../utils/errors.js';
import { roleGuard } from '../middleware/auth.js';

interface TeacherBatchRow {
  teacher_id: string;
}

export const attendanceRouter = Router();

// Only teachers can submit or edit attendance, strictly for their assigned batches
const teacherBatchOwnership = async (req: any, _res: any, next: any) => {
  const auth = req.auth;
  if (auth.role !== 'TEACHER') {
    return next(new AppError(403, 'FORBIDDEN', 'Only assigned teachers can record or edit attendance'));
  }

  const db = req.db;
  const batchId = req.body.batchId;

  if (!batchId) {
    return next(new AppError(422, 'BATCH_ID_REQUIRED', 'batchId is required'));
  }

  const result = await db.query(
    `SELECT teacher_id FROM batches WHERE batch_id = $1 AND institute_id = $2`,
    [batchId, db.instituteId],
  );

  const batch = result.rows[0] as TeacherBatchRow | undefined;
  if (!batch || batch.teacher_id !== auth.userId) {
    return next(new AppError(403, 'FORBIDDEN', 'Teachers can only submit attendance for their assigned batches'));
  }
  next();
};

const attendanceSubmissionSchema = z.object({
  batchId: z.string().uuid(),
  attendanceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD for the attendance date.')
    .optional(),
  records: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        status: z.enum(['PRESENT', 'ABSENT']),
      }),
    )
    .min(1)
    .max(1000),
});

attendanceRouter.post(
  '/submit',
  roleGuard('TEACHER'),
  teacherBatchOwnership,
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req.auth);
    const db = requireTenantDb(req.db);

    const parsed = attendanceSubmissionSchema.safeParse(req.body);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const summary = await submitAttendance(db, auth, parsed.data);
    res.status(200).json({ success: true, data: { attendance: summary } });
  }),
);
