import { Router } from 'express';
import { z } from 'zod';

import {
  listLeads,
  updateLeadStatus,
  listBatchesAdmin,
  createBatch,
  updateBatch,
  listStudents,
  createStudent,
  updateStudent,
  bulkImportStudents,
  getDailyAttendanceReport,
} from '../services/admin.service.js';
import { requireTenantDb } from '../types/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validationError } from '../utils/errors.js';
import { roleGuard } from '../middleware/auth.js';

export const adminRouter = Router();

// All admin routes require ADMIN or RECEPTIONIST role
adminRouter.use(roleGuard('SUPER_ADMIN', 'INSTITUTE_ADMIN', 'RECEPTIONIST'));

/* ========================================================================== */
/* Leads                                                                        */
/* ========================================================================== */

const leadQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'ENROLLED', 'LOST']).optional(),
});

adminRouter.get(
  '/leads',
  asyncHandler(async (req, res) => {
    const db = requireTenantDb(req.db);
    const parsed = leadQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const result = await listLeads(db, parsed.data.page, parsed.data.pageSize, parsed.data.status);
    res.status(200).json({ success: true, data: result });
  }),
);

const updateLeadStatusSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'ENROLLED', 'LOST']),
  notes: z.string().trim().max(1000).optional(),
});

adminRouter.patch(
  '/leads/:id',
  asyncHandler(async (req, res) => {
    const db = requireTenantDb(req.db);
    const leadId = req.params.id as string;

    const parsed = updateLeadStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const lead = await updateLeadStatus(db, leadId, parsed.data);
    res.status(200).json({ success: true, data: { lead } });
  }),
);

/* ========================================================================== */
/* Batches                                                                      */
/* ========================================================================== */

adminRouter.get(
  '/batches',
  asyncHandler(async (req, res) => {
    const db = requireTenantDb(req.db);
    const result = await listBatchesAdmin(db);
    res.status(200).json({ success: true, data: result });
  }),
);

const createBatchSchema = z.object({
  name: z.string().trim().min(1).max(255),
  targetExam: z.enum(['CAT', 'CLASS_12_PCM']),
  teacherId: z.string().uuid().nullable(),
  scheduledStartTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Use HH:MM:SS format'),
  scheduledEndTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Use HH:MM:SS format'),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  roomNumber: z.string().max(50).nullable(),
  isActive: z.boolean().default(true),
});

adminRouter.post(
  '/batches',
  asyncHandler(async (req, res) => {
    const db = requireTenantDb(req.db);
    const parsed = createBatchSchema.safeParse(req.body);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const batch = await createBatch(db, parsed.data);
    res.status(201).json({ success: true, data: { batch } });
  }),
);

const updateBatchSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  targetExam: z.enum(['CAT', 'CLASS_12_PCM']).optional(),
  teacherId: z.string().uuid().nullable().optional(),
  scheduledStartTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
  scheduledEndTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/).optional(),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
  roomNumber: z.string().max(50).nullable().optional(),
  isActive: z.boolean().optional(),
});

adminRouter.patch(
  '/batches/:id',
  asyncHandler(async (req, res) => {
    const db = requireTenantDb(req.db);
    const batchId = req.params.id as string;

    const parsed = updateBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const batch = await updateBatch(db, batchId, parsed.data);
    res.status(200).json({ success: true, data: { batch } });
  }),
);

/* ========================================================================== */
/* Students                                                                     */
/* ========================================================================== */

const studentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  batchId: z.string().uuid().optional(),
});

adminRouter.get(
  '/students',
  asyncHandler(async (req, res) => {
    const db = requireTenantDb(req.db);
    const parsed = studentQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const result = await listStudents(db, parsed.data.page, parsed.data.pageSize, parsed.data.batchId);
    res.status(200).json({ success: true, data: result });
  }),
);

const createStudentSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  rollNumber: z.string().trim().min(1).max(50),
  parentName: z.string().trim().min(1).max(255),
  parentWhatsapp: z.string().trim().min(10).max(20),
  parentSecondaryPhone: z.string().trim().max(20).nullable(),
  batchId: z.string().uuid().nullable(),
  isActive: z.boolean().default(true),
});

adminRouter.post(
  '/students',
  asyncHandler(async (req, res) => {
    const db = requireTenantDb(req.db);
    const parsed = createStudentSchema.safeParse(req.body);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const student = await createStudent(db, parsed.data);
    res.status(201).json({ success: true, data: { student } });
  }),
);

const updateStudentSchema = z.object({
  fullName: z.string().trim().min(1).max(255).optional(),
  rollNumber: z.string().trim().min(1).max(50).optional(),
  parentName: z.string().trim().min(1).max(255).optional(),
  parentWhatsapp: z.string().trim().min(10).max(20).optional(),
  parentSecondaryPhone: z.string().trim().max(20).nullable().optional(),
  batchId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

adminRouter.patch(
  '/students/:id',
  asyncHandler(async (req, res) => {
    const db = requireTenantDb(req.db);
    const studentId = req.params.id as string;

    const parsed = updateStudentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const student = await updateStudent(db, studentId, parsed.data);
    res.status(200).json({ success: true, data: { student } });
  }),
);

const bulkImportSchema = z.object({
  students: z.array(createStudentSchema).min(1).max(500),
});

adminRouter.post(
  '/students/bulk',
  asyncHandler(async (req, res) => {
    const db = requireTenantDb(req.db);
    const parsed = bulkImportSchema.safeParse(req.body);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const result = await bulkImportStudents(db, { students: parsed.data.students });
    res.status(200).json({ success: true, data: result });
  }),
);

/* ========================================================================== */
/* Daily Attendance Report                                                     */
/* ========================================================================== */

const dailyReportQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format').optional(),
});

adminRouter.get(
  '/reports/daily',
  asyncHandler(async (req, res) => {
    const db = requireTenantDb(req.db);
    const parsed = dailyReportQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const report = await getDailyAttendanceReport(db, parsed.data.date);
    res.status(200).json({ success: true, data: { report } });
  }),
);