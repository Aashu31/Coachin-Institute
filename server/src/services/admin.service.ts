import type { TenantDb } from '../types/tenant.js';
import type {
  AdminLeadDto,
  LeadListResult,
  UpdateLeadStatusInput,
  AdminBatchDto,
  BatchListResultAdmin,
  CreateBatchInput,
  UpdateBatchInput,
  AdminStudentDto,
  StudentListResult,
  CreateStudentInput,
  UpdateStudentInput,
  BulkStudentImportInput,
  BulkImportResult,
  DailyAttendanceReportDto,
  LeadTargetCourse,
} from '../types/domain.js';
import { AppError } from '../utils/errors.js';
import { normalizeIndianMobile } from '../utils/phone.js';
import { getTenantDate } from '../utils/datetime.js';

const LEAD_STATUSES: LeadTargetCourse[] = ['CAT', 'CLASS_12_PCM'];
const VALID_LEAD_STATUSES = ['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'ENROLLED', 'LOST'] as const;
const VALID_DAYS_OF_WEEK = [1, 2, 3, 4, 5, 6, 7];

function assertValidLeadStatus(status: string): asserts status is (typeof VALID_LEAD_STATUSES)[number] {
  if (!VALID_LEAD_STATUSES.includes(status as any)) {
    throw new AppError(422, 'INVALID_LEAD_STATUS', `Invalid lead status: ${status}`);
  }
}

function assertValidDaysOfWeek(days: number[]): void {
  if (!Array.isArray(days) || days.length === 0) {
    throw new AppError(422, 'INVALID_DAYS_OF_WEEK', 'daysOfWeek must be a non-empty array');
  }
  for (const d of days) {
    if (!VALID_DAYS_OF_WEEK.includes(d)) {
      throw new AppError(422, 'INVALID_DAYS_OF_WEEK', `Invalid day of week: ${d} (must be 1-7)`);
    }
  }
}

/* ========================================================================== */
/* Leads                                                                       */
/* ========================================================================== */

interface LeadRow {
  lead_id: string;
  student_name: string;
  whatsapp_number: string;
  target_course: LeadTargetCourse;
  preferred_slot: any;
  status: any;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function toAdminLeadDto(row: LeadRow): AdminLeadDto {
  return {
    leadId: row.lead_id,
    studentName: row.student_name,
    whatsappNumber: row.whatsapp_number,
    targetCourse: row.target_course,
    preferredSlot: row.preferred_slot,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // snake_case aliases for backwards compatibility
    ...({
      lead_id: row.lead_id,
      student_name: row.student_name,
      whatsapp_number: row.whatsapp_number,
      target_course: row.target_course,
      preferred_slot: row.preferred_slot,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as any),
  };
}

export async function listLeads(
  db: TenantDb,
  page = 1,
  pageSize = 20,
  status?: string,
): Promise<LeadListResult> {
  const offset = (page - 1) * pageSize;
  const dataParams: (string | number)[] = [db.instituteId, pageSize, offset];
  let dataStatusSql = '';

  const countParams: (string | number)[] = [db.instituteId];
  let countStatusSql = '';

  if (status) {
    dataParams.push(status);
    dataStatusSql = `AND l.status = $${dataParams.length}`;

    countParams.push(status);
    countStatusSql = `AND l.status = $${countParams.length}`;
  }

  const [dataResult, countResult] = await Promise.all([
    db.query<LeadRow>(
      `SELECT l.lead_id, l.student_name, l.whatsapp_number, l.target_course, l.preferred_slot,
              l.status, l.notes,
              TO_CHAR(l.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
              TO_CHAR(COALESCE(l.updated_at, l.created_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at
         FROM leads l
        WHERE l.institute_id = $1
          ${dataStatusSql}
        ORDER BY l.created_at DESC
        LIMIT $2 OFFSET $3`,
      dataParams,
    ),
    db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM leads l WHERE l.institute_id = $1 ${countStatusSql}`,
      countParams,
    ),
  ]);

  return {
    leads: dataResult.rows.map(toAdminLeadDto),
    total: Number(countResult.rows[0]?.total ?? '0'),
    page,
    pageSize,
  };
}

export async function updateLeadStatus(
  db: TenantDb,
  leadId: string,
  input: UpdateLeadStatusInput,
): Promise<AdminLeadDto> {
  assertValidLeadStatus(input.status);

  const result = await db.query<LeadRow>(
    `UPDATE leads
        SET status = $1,
            notes = COALESCE($2, notes),
            updated_at = CURRENT_TIMESTAMP
      WHERE lead_id = $3 AND institute_id = $4
      RETURNING
        lead_id, student_name, whatsapp_number, target_course, preferred_slot,
        status, notes,
        TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
        TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at`,
    [input.status, input.notes ?? null, leadId, db.instituteId],
  );

  const lead = result.rows[0];
  if (!lead) {
    throw new AppError(404, 'LEAD_NOT_FOUND', 'Lead not found');
  }
  return toAdminLeadDto(lead);
}

/* ========================================================================== */
/* Batches                                                                      */
/* ========================================================================== */

interface BatchRow {
  batch_id: string;
  name: string;
  target_exam: string;
  teacher_id: string | null;
  teacher_name?: string | null;
  scheduled_start_time: string;
  scheduled_end_time: string;
  days_of_week: number[];
  room_number: string | null;
  is_active: boolean;
  student_count?: number;
  created_at: string;
  updated_at: string;
}

function toAdminBatchDto(row: BatchRow): AdminBatchDto {
  return {
    batchId: row.batch_id,
    name: row.name,
    targetExam: row.target_exam,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name ?? null,
    scheduledStartTime: row.scheduled_start_time,
    scheduledEndTime: row.scheduled_end_time,
    daysOfWeek: row.days_of_week ?? [],
    roomNumber: row.room_number,
    isActive: row.is_active,
    studentCount: Number(row.student_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // snake_case aliases for backwards compatibility
    ...({
      batch_id: row.batch_id,
      target_exam: row.target_exam,
      teacher_id: row.teacher_id,
      teacher_name: row.teacher_name ?? null,
      scheduled_start_time: row.scheduled_start_time,
      scheduled_end_time: row.scheduled_end_time,
      days_of_week: row.days_of_week ?? [],
      room_number: row.room_number,
      is_active: row.is_active,
      student_count: Number(row.student_count ?? 0),
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as any),
  };
}

export async function listBatchesAdmin(db: TenantDb): Promise<BatchListResultAdmin> {
  const result = await db.query<BatchRow>(
    `SELECT b.batch_id, b.name, b.target_exam, b.teacher_id, u.full_name AS teacher_name,
            TO_CHAR(b.scheduled_start_time, 'HH24:MI:SS') AS scheduled_start_time,
            TO_CHAR(b.scheduled_end_time, 'HH24:MI:SS') AS scheduled_end_time,
            COALESCE(b.days_of_week, '{}') AS days_of_week,
            b.room_number, b.is_active,
            (SELECT COUNT(*)::int FROM students s WHERE s.batch_id = b.batch_id AND s.is_active) AS student_count,
            TO_CHAR(b.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
            TO_CHAR(b.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at
       FROM batches b
       LEFT JOIN users u ON u.user_id = b.teacher_id
      WHERE b.institute_id = $1
      ORDER BY b.scheduled_start_time, b.name`,
    [db.instituteId],
  );

  return { batches: result.rows.map(toAdminBatchDto), total: result.rows.length ?? 0 };
}

export async function createBatch(db: TenantDb, input: CreateBatchInput): Promise<AdminBatchDto> {
  if (!LEAD_STATUSES.includes(input.targetExam)) {
    throw new AppError(422, 'INVALID_TARGET_EXAM', 'targetExam must be CAT or CLASS_12_PCM');
  }
  assertValidDaysOfWeek(input.daysOfWeek);

  if (input.teacherId) {
    const teacherCheck = await db.query<{ user_id: string }>(
      `SELECT user_id FROM users WHERE user_id = $1 AND institute_id = $2 AND role = 'TEACHER' AND is_active`,
      [input.teacherId, db.instituteId],
    );
    if (teacherCheck.rows.length === 0) {
      throw new AppError(422, 'INVALID_TEACHER', 'Teacher not found or not active');
    }
  }

  const result = await db.query<BatchRow>(
    `INSERT INTO batches (
        institute_id, name, target_exam, teacher_id,
        scheduled_start_time, scheduled_end_time, days_of_week, room_number, is_active
      ) VALUES ($1, $2, $3, $4, $5::time, $6::time, $7::int[], $8, $9)
      RETURNING
        batch_id, name, target_exam, teacher_id,
        TO_CHAR(scheduled_start_time, 'HH24:MI:SS') AS scheduled_start_time,
        TO_CHAR(scheduled_end_time, 'HH24:MI:SS') AS scheduled_end_time,
        COALESCE(days_of_week, '{}') AS days_of_week,
        room_number, is_active,
        0 AS student_count,
        TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
        TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at`,
    [
      db.instituteId,
      input.name,
      input.targetExam,
      input.teacherId,
      input.scheduledStartTime,
      input.scheduledEndTime,
      input.daysOfWeek,
      input.roomNumber,
      input.isActive ?? true,
    ],
  );

  const batch = result.rows[0];
  if (!batch) {
    throw new AppError(500, 'BATCH_CREATE_FAILED', 'Failed to create batch');
  }
  return toAdminBatchDto(batch);
}

export async function updateBatch(
  db: TenantDb,
  batchId: string,
  input: UpdateBatchInput,
): Promise<AdminBatchDto> {
  if (input.targetExam && !LEAD_STATUSES.includes(input.targetExam)) {
    throw new AppError(422, 'INVALID_TARGET_EXAM', 'targetExam must be CAT or CLASS_12_PCM');
  }
  if (input.daysOfWeek) assertValidDaysOfWeek(input.daysOfWeek);

  if (input.teacherId) {
    const teacherCheck = await db.query<{ user_id: string }>(
      `SELECT user_id FROM users WHERE user_id = $1 AND institute_id = $2 AND role = 'TEACHER' AND is_active`,
      [input.teacherId, db.instituteId],
    );
    if (teacherCheck.rows.length === 0) {
      throw new AppError(422, 'INVALID_TEACHER', 'Teacher not found or not active');
    }
  }

  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  const fieldMap: Record<string, string> = {
    name: 'name',
    targetExam: 'target_exam',
    teacherId: 'teacher_id',
    scheduledStartTime: 'scheduled_start_time',
    scheduledEndTime: 'scheduled_end_time',
    daysOfWeek: 'days_of_week',
    roomNumber: 'room_number',
    isActive: 'is_active',
  };

  for (const [key, column] of Object.entries(fieldMap)) {
    const value = input[key as keyof UpdateBatchInput];
    if (value !== undefined) {
      fields.push(`${column} = $${paramIndex}`);
      if (key === 'daysOfWeek') {
        values.push(value);
      } else if (key === 'scheduledStartTime' || key === 'scheduledEndTime') {
        values.push(value);
      } else {
        values.push(value);
      }
      paramIndex++;
    }
  }

  if (fields.length === 0) {
    throw new AppError(422, 'NO_FIELDS_TO_UPDATE', 'No valid fields provided for update');
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(batchId, db.instituteId);

  const result = await db.query<BatchRow>(
    `UPDATE batches
        SET ${fields.join(', ')}
      WHERE batch_id = $${paramIndex} AND institute_id = $${paramIndex + 1}
      RETURNING
        batch_id, name, target_exam, teacher_id,
        TO_CHAR(scheduled_start_time, 'HH24:MI:SS') AS scheduled_start_time,
        TO_CHAR(scheduled_end_time, 'HH24:MI:SS') AS scheduled_end_time,
        COALESCE(days_of_week, '{}') AS days_of_week,
        room_number, is_active,
        (SELECT COUNT(*)::int FROM students s WHERE s.batch_id = batches.batch_id AND s.is_active) AS student_count,
        TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
        TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at`,
    values,
  );

  if (result.rows.length === 0) {
    throw new AppError(404, 'BATCH_NOT_FOUND', 'Batch not found');
  }
  return toAdminBatchDto(result.rows[0]!);
}

/* ========================================================================== */
/* Students                                                                     */
/* ========================================================================== */

interface StudentRow {
  student_id: string;
  full_name: string;
  roll_number: string;
  parent_name: string;
  parent_whatsapp: string;
  parent_secondary_phone: string | null;
  batch_id: string | null;
  batch_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function toAdminStudentDto(row: StudentRow): AdminStudentDto {
  return {
    studentId: row.student_id,
    fullName: row.full_name,
    rollNumber: row.roll_number,
    parentName: row.parent_name,
    parentWhatsapp: row.parent_whatsapp,
    parentSecondaryPhone: row.parent_secondary_phone,
    batchId: row.batch_id,
    batchName: row.batch_name ?? null,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // snake_case aliases for backwards compatibility
    ...({
      student_id: row.student_id,
      full_name: row.full_name,
      roll_number: row.roll_number,
      parent_name: row.parent_name,
      parent_whatsapp: row.parent_whatsapp,
      parent_secondary_phone: row.parent_secondary_phone,
      batch_id: row.batch_id,
      batch_name: row.batch_name ?? null,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as any),
  };
}

export async function listStudents(
  db: TenantDb,
  page = 1,
  pageSize = 20,
  batchId?: string,
): Promise<StudentListResult> {
  const offset = (page - 1) * pageSize;
  const dataParams: (string | number)[] = [db.instituteId, pageSize, offset];
  let dataBatchSql = '';

  const countParams: (string | number)[] = [db.instituteId];
  let countBatchSql = '';

  if (batchId) {
    dataParams.push(batchId);
    dataBatchSql = `AND s.batch_id = $${dataParams.length}`;

    countParams.push(batchId);
    countBatchSql = `AND s.batch_id = $${countParams.length}`;
  }

  const [dataResult, countResult] = await Promise.all([
    db.query<StudentRow>(
      `SELECT s.student_id, s.full_name, s.roll_number, s.parent_name, s.parent_whatsapp,
              s.parent_secondary_phone, s.batch_id, b.name AS batch_name, s.is_active,
              TO_CHAR(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
              TO_CHAR(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at
         FROM students s
         LEFT JOIN batches b ON b.batch_id = s.batch_id
        WHERE s.institute_id = $1
          ${dataBatchSql}
        ORDER BY s.created_at DESC
        LIMIT $2 OFFSET $3`,
      dataParams,
    ),
    db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM students s WHERE s.institute_id = $1 ${countBatchSql}`,
      countParams,
    ),
  ]);

  return {
    students: dataResult.rows.map(toAdminStudentDto),
    total: Number(countResult.rows[0]?.total ?? '0'),
    page,
    pageSize,
  };
}

export async function createStudent(db: TenantDb, input: CreateStudentInput): Promise<AdminStudentDto> {
  const whatsappNumber = normalizeIndianMobile(input.parentWhatsapp);
  const secondaryPhone = input.parentSecondaryPhone
    ? normalizeIndianMobile(input.parentSecondaryPhone)
    : null;

  if (input.batchId) {
    const batchCheck = await db.query<{ batch_id: string }>(
      `SELECT batch_id FROM batches WHERE batch_id = $1 AND institute_id = $2 AND is_active`,
      [input.batchId, db.instituteId],
    );
    if (batchCheck.rows.length === 0) {
      throw new AppError(422, 'INVALID_BATCH', 'Batch not found or not active');
    }
  }

  const result = await db.query<StudentRow>(
    `INSERT INTO students (
        institute_id, batch_id, full_name, roll_number,
        parent_name, parent_whatsapp, parent_secondary_phone, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (institute_id, roll_number) DO UPDATE SET
        batch_id = EXCLUDED.batch_id,
        full_name = EXCLUDED.full_name,
        parent_name = EXCLUDED.parent_name,
        parent_whatsapp = EXCLUDED.parent_whatsapp,
        parent_secondary_phone = EXCLUDED.parent_secondary_phone,
        is_active = EXCLUDED.is_active
      RETURNING
        student_id, full_name, roll_number, parent_name, parent_whatsapp,
        parent_secondary_phone, batch_id,
        (SELECT name FROM batches WHERE batch_id = students.batch_id) AS batch_name,
        is_active,
        TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
        TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at`,
    [
      db.instituteId,
      input.batchId,
      input.fullName,
      input.rollNumber,
      input.parentName,
      whatsappNumber,
      secondaryPhone,
      input.isActive ?? true,
    ],
  );

  const student = result.rows[0];
  if (!student) {
    throw new AppError(500, 'STUDENT_CREATE_FAILED', 'Failed to create student');
  }
  return toAdminStudentDto(student);
}

export async function updateStudent(
  db: TenantDb,
  studentId: string,
  input: UpdateStudentInput,
): Promise<AdminStudentDto> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (input.fullName !== undefined) {
    fields.push(`full_name = $${paramIndex}`);
    values.push(input.fullName);
    paramIndex++;
  }
  if (input.rollNumber !== undefined) {
    fields.push(`roll_number = $${paramIndex}`);
    values.push(input.rollNumber);
    paramIndex++;
  }
  if (input.parentName !== undefined) {
    fields.push(`parent_name = $${paramIndex}`);
    values.push(input.parentName);
    paramIndex++;
  }
  if (input.parentWhatsapp !== undefined) {
    fields.push(`parent_whatsapp = $${paramIndex}`);
    values.push(normalizeIndianMobile(input.parentWhatsapp));
    paramIndex++;
  }
  if (input.parentSecondaryPhone !== undefined) {
    fields.push(`parent_secondary_phone = $${paramIndex}`);
    values.push(input.parentSecondaryPhone ? normalizeIndianMobile(input.parentSecondaryPhone) : null);
    paramIndex++;
  }
  if (input.batchId !== undefined) {
    fields.push(`batch_id = $${paramIndex}`);
    values.push(input.batchId);
    paramIndex++;
  }
  if (input.isActive !== undefined) {
    fields.push(`is_active = $${paramIndex}`);
    values.push(input.isActive);
    paramIndex++;
  }

  if (fields.length === 0) {
    throw new AppError(422, 'NO_FIELDS_TO_UPDATE', 'No valid fields provided for update');
  }

  if (input.batchId) {
    const batchCheck = await db.query<{ batch_id: string }>(
      `SELECT batch_id FROM batches WHERE batch_id = $1 AND institute_id = $2 AND is_active`,
      [input.batchId, db.instituteId],
    );
    if (batchCheck.rows.length === 0) {
      throw new AppError(422, 'INVALID_BATCH', 'Batch not found or not active');
    }
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(studentId, db.instituteId);

  const result = await db.query<StudentRow>(
    `UPDATE students
        SET ${fields.join(', ')}
      WHERE student_id = $${paramIndex} AND institute_id = $${paramIndex + 1}
      RETURNING
        student_id, full_name, roll_number, parent_name, parent_whatsapp,
        parent_secondary_phone, batch_id,
        (SELECT name FROM batches WHERE batch_id = students.batch_id) AS batch_name,
        is_active,
        TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
        TO_CHAR(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at`,
    values,
  );

  const student = result.rows[0];
  if (!student) {
    throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }
  return toAdminStudentDto(student);
}

export async function bulkImportStudents(
  db: TenantDb,
  input: BulkStudentImportInput,
): Promise<BulkImportResult> {
  const result: BulkImportResult = { created: 0, updated: 0, errors: [] };

  for (let i = 0; i < input.students.length; i++) {
    const rowNum = i + 1;
    const student = input.students[i]!;
    const studentData = { fullName: student.fullName, rollNumber: student.rollNumber, parentName: student.parentName, parentWhatsapp: student.parentWhatsapp, parentSecondaryPhone: student.parentSecondaryPhone, batchId: student.batchId, isActive: student.isActive };

    try {
      const whatsappNumber = normalizeIndianMobile(student.parentWhatsapp);
      const secondaryPhone = student.parentSecondaryPhone
        ? normalizeIndianMobile(student.parentSecondaryPhone)
        : null;

      if (student.batchId) {
        const batchCheck = await db.query<{ batch_id: string }>(
          `SELECT batch_id FROM batches WHERE batch_id = $1 AND institute_id = $2 AND is_active`,
          [student.batchId, db.instituteId],
        );
        if (batchCheck.rows.length === 0) {
          throw new AppError(422, 'INVALID_BATCH', `Batch ${student.batchId} not found or not active`);
        }
      }

      const existing = await db.query<{ student_id: string }>(
        `SELECT student_id FROM students WHERE institute_id = $1 AND roll_number = $2`,
        [db.instituteId, student.rollNumber],
      );

      if (existing.rows.length > 0) {
        await db.query(
          `UPDATE students
              SET batch_id = $1, full_name = $2, parent_name = $3,
                  parent_whatsapp = $4, parent_secondary_phone = $5, is_active = $6,
                  updated_at = CURRENT_TIMESTAMP
            WHERE institute_id = $7 AND roll_number = $8`,
          [
            student.batchId,
            student.fullName,
            student.parentName,
            whatsappNumber,
            secondaryPhone,
            student.isActive ?? true,
            db.instituteId,
            student.rollNumber,
          ],
        );
        result.updated++;
      } else {
        await db.query(
          `INSERT INTO students (
              institute_id, batch_id, full_name, roll_number,
              parent_name, parent_whatsapp, parent_secondary_phone, is_active
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            db.instituteId,
            student.batchId,
            student.fullName,
            student.rollNumber,
            student.parentName,
            whatsappNumber,
            secondaryPhone,
            student.isActive ?? true,
          ],
        );
        result.created++;
      }
    } catch (error) {
      result.errors.push({
        row: rowNum,
        error: error instanceof Error ? error.message : String(error),
        data: studentData,
      });
    }
  }

  return result;
}

/* ========================================================================== */
/* Daily Attendance Report                                                     */
/* ========================================================================== */

export async function getDailyAttendanceReport(
  db: TenantDb,
  date?: string,
): Promise<DailyAttendanceReportDto> {
  const today = getTenantDate('Asia/Kolkata');
  const reportDate = date ?? today.date;

  // Get all active batches with their attendance sessions for the date
  const batchesResult = await db.query<{
    batch_id: string;
    name: string;
    scheduled_start_time: string;
  }>(
    `SELECT batch_id, name, TO_CHAR(scheduled_start_time, 'HH24:MI:SS') AS scheduled_start_time
       FROM batches
      WHERE institute_id = $1 AND is_active = TRUE`,
    [db.instituteId],
  );

  const batchDetails: DailyAttendanceReportDto['batches'] = [];
  let totalStudents = 0;
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalResponseTimeSum = 0;
  let totalResponseTimeCount = 0;
  let totalUnresolvedAlerts = 0;

  for (const batch of batchesResult.rows) {
    // Get session for this date
    const sessionResult = await db.query<{
      session_id: string;
      total_students: number;
      present_count: number;
      absent_count: number;
      class_start_time: string;
    }>(
      `SELECT session_id, total_students, present_count, absent_count,
              TO_CHAR(class_start_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS class_start_time
         FROM attendance_sessions
        WHERE institute_id = $1 AND batch_id = $2 AND session_date = $3::date`,
      [db.instituteId, batch.batch_id, reportDate],
    );

    const session = sessionResult.rows[0];

    let presentCount = 0;
    let absentCount = 0;
    let avgResponseTime: number | null = null;
    let unresolvedRedAlerts = 0;

    if (session) {
      presentCount = session.present_count;
      absentCount = session.absent_count;

      // Calculate avg parent response time for this batch
      const responseResult = await db.query<{ response_time_minutes: number }>(
        `SELECT AVG(EXTRACT(EPOCH FROM (parent_responded_at - whatsapp_sent_at)) / 60)::numeric(10,2) AS response_time_minutes
           FROM attendance_logs al
           JOIN attendance_sessions ses ON ses.session_id = al.session_id
          WHERE al.institute_id = $1
            AND ses.batch_id = $2
            AND ses.session_date = $3::date
            AND al.whatsapp_sent_at IS NOT NULL
            AND al.parent_responded_at IS NOT NULL
            AND al.status IN ('PARENT_VERIFIED_LEAVE', 'PARENT_VERIFIED_LATE', 'PARENT_FLAGGED_BUNK')`,
        [db.instituteId, batch.batch_id, reportDate],
      );
      if (responseResult.rows[0]?.response_time_minutes != null) {
        avgResponseTime = Number(responseResult.rows[0].response_time_minutes);
        totalResponseTimeSum += avgResponseTime;
        totalResponseTimeCount++;
      }

      // Count unresolved red alerts
      const alertResult = await db.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
           FROM escalation_tasks et
           JOIN attendance_logs al ON al.log_id = et.log_id
           JOIN attendance_sessions ses ON ses.session_id = al.session_id
          WHERE et.institute_id = $1
            AND ses.batch_id = $2
            AND ses.session_date = $3::date
            AND et.resolved_at IS NULL`,
        [db.instituteId, batch.batch_id, reportDate],
      );
      unresolvedRedAlerts = Number(alertResult.rows[0]?.count ?? '0');
    }

    batchDetails.push({
      batchId: batch.batch_id,
      batchName: batch.name,
      scheduledStartTime: batch.scheduled_start_time,
      totalStudents: session?.total_students ?? 0,
      presentCount,
      absentCount,
      presentPercentage: session?.total_students && session.total_students > 0
        ? Math.round((presentCount / session.total_students) * 10000) / 100
        : 0,
      avgParentResponseTimeMinutes: avgResponseTime,
      unresolvedRedAlerts,
    });

    totalStudents += session?.total_students ?? 0;
    totalPresent += presentCount;
    totalAbsent += absentCount;
    totalUnresolvedAlerts += unresolvedRedAlerts;
  }

  const overallPresentPct = totalStudents > 0
    ? Math.round((totalPresent / totalStudents) * 10000) / 100
    : 0;

  const overallAvgResponseTime = totalResponseTimeCount > 0
    ? Math.round((totalResponseTimeSum / totalResponseTimeCount) * 100) / 100
    : null;

  return {
    date: reportDate,
    totalStudents,
    presentCount: totalPresent,
    absentCount: totalAbsent,
    presentPercentage: overallPresentPct,
    batches: batchDetails,
    avgParentResponseTimeMinutes: overallAvgResponseTime,
    unresolvedRedAlerts: totalUnresolvedAlerts,
  };
}