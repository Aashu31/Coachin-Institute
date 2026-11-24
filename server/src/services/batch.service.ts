import { env } from '../config/env.js';
import type {
  AttendanceSheetStatus,
  AttendanceSummaryDto,
  BatchListResult,
  BatchRosterResult,
  BatchSummaryDto,
  RosterStudentDto,
} from '../types/domain.js';
import type { AuthContext } from '../types/domain.js';
import type { TenantDb } from '../types/tenant.js';
import { AppError } from '../utils/errors.js';
import { getTenantDate } from '../utils/datetime.js';

const ISO_TIMESTAMP =
  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

interface BatchQueryRow {
  batch_id: string;
  name: string;
  target_exam: string;
  teacher_id: string | null;
  teacher_name: string | null;
  scheduled_start_time: string;
  scheduled_end_time: string;
  days_of_week: number[] | null;
  room_number: string | null;
  student_count: number;
  session_id: string | null;
  session_date: string | null;
  present_count: number | null;
  absent_count: number | null;
  submitted_at: string | null;
  verification_scheduled_at: string | null;
}

interface RosterRow {
  student_id: string;
  full_name: string;
  roll_number: string;
  status: string | null;
}

function toBatchSummary(row: BatchQueryRow, isoDay: number): BatchSummaryDto {
  const daysOfWeek = row.days_of_week ?? [];
  const isScheduledToday = daysOfWeek.includes(isoDay);

  let attendanceStatus: AttendanceSheetStatus = 'NOT_SCHEDULED';

  if (row.session_id) {
    attendanceStatus = 'SUBMITTED';
  } else if (isScheduledToday) {
    attendanceStatus = 'PENDING';
  }

  return {
    batchId: row.batch_id,
    name: row.name,
    targetExam: row.target_exam,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    scheduledStartTime: row.scheduled_start_time,
    scheduledEndTime: row.scheduled_end_time,
    daysOfWeek,
    roomNumber: row.room_number,
    studentCount: row.student_count,
    isScheduledToday,
    attendanceStatus,
    sessionId: row.session_id,
    presentCount: row.present_count ?? 0,
    absentCount: row.absent_count ?? 0,
    submittedAt: row.submitted_at,
  };
}

async function queryBatchRows(
  db: TenantDb,
  auth: AuthContext,
  batchId: string | null,
): Promise<{ rows: BatchQueryRow[]; today: string; isoDay: number }> {
  const today = getTenantDate(env.APP_TIMEZONE);
  const restrictToTeacher = auth.role === 'TEACHER';

  const result = await db.query<BatchQueryRow>(
    `SELECT
        b.batch_id,
        b.name,
        b.target_exam,
        b.teacher_id,
        u.full_name AS teacher_name,
        TO_CHAR(b.scheduled_start_time, 'HH24:MI') AS scheduled_start_time,
        TO_CHAR(b.scheduled_end_time, 'HH24:MI') AS scheduled_end_time,
        COALESCE(b.days_of_week, '{}') AS days_of_week,
        b.room_number,
        (SELECT COUNT(*)::int
           FROM students st
          WHERE st.batch_id = b.batch_id AND st.is_active) AS student_count,
        ses.session_id,
        TO_CHAR(ses.session_date, 'YYYY-MM-DD') AS session_date,
        ses.present_count,
        ses.absent_count,
        TO_CHAR(ses.marked_at AT TIME ZONE 'UTC', '${ISO_TIMESTAMP}') AS submitted_at,
        TO_CHAR(
          (ses.class_start_time + INTERVAL '10 minutes') AT TIME ZONE 'UTC',
          '${ISO_TIMESTAMP}'
        ) AS verification_scheduled_at
       FROM batches b
       LEFT JOIN users u ON u.user_id = b.teacher_id
       LEFT JOIN attendance_sessions ses
         ON ses.batch_id = b.batch_id
        AND ses.session_date = $3::date
      WHERE b.institute_id = $1
        AND b.is_active = TRUE
        AND ($2::uuid IS NULL OR b.batch_id = $2::uuid)
        AND ($4::boolean = FALSE OR b.teacher_id = $5::uuid)
      ORDER BY b.scheduled_start_time, b.name`,
    [db.instituteId, batchId, today.date, restrictToTeacher, auth.userId],
  );

  return { rows: result.rows, today: today.date, isoDay: today.isoDay };
}

/** Today's timetable plus every active batch the caller may view. */
export async function listBatches(db: TenantDb, auth: AuthContext): Promise<BatchListResult> {
  const { rows, today, isoDay } = await queryBatchRows(db, auth, null);

  return {
    batches: rows.map((row) => toBatchSummary(row, isoDay)),
    today,
    timezone: env.APP_TIMEZONE,
  };
}

/**
 * Roster for the attendance sheet. Parent contact details are deliberately not
 * selected: governance rule 4.3 forbids shipping parent WhatsApp numbers to
 * client applications, and teachers do not need them to mark attendance.
 */
export async function getBatchRoster(
  db: TenantDb,
  auth: AuthContext,
  batchId: string,
): Promise<BatchRosterResult> {
  const { rows, today, isoDay } = await queryBatchRows(db, auth, batchId);
  const batchRow = rows[0];

  if (!batchRow) {
    throw new AppError(404, 'BATCH_NOT_FOUND', 'This batch does not exist in your institute.');
  }

  const studentsResult = await db.query<RosterRow>(
    `SELECT
        st.student_id,
        st.full_name,
        st.roll_number,
        al.status
       FROM students st
       LEFT JOIN attendance_sessions ses
         ON ses.batch_id = st.batch_id
        AND ses.session_date = $3::date
       LEFT JOIN attendance_logs al
         ON al.session_id = ses.session_id
        AND al.student_id = st.student_id
      WHERE st.institute_id = $1
        AND st.batch_id = $2
        AND st.is_active = TRUE
      ORDER BY st.roll_number`,
    [db.instituteId, batchId, today],
  );

  const students: RosterStudentDto[] = studentsResult.rows.map((row) => {
    let status: RosterStudentDto['status'] = null;

    if (row.status === 'PRESENT') {
      status = 'PRESENT';
    } else if (row.status !== null) {
      status = 'ABSENT';
    }

    return {
      studentId: row.student_id,
      fullName: row.full_name,
      rollNumber: row.roll_number,
      status,
    };
  });

  const batch = toBatchSummary(batchRow, isoDay);

  const existingAttendance: AttendanceSummaryDto | null = batchRow.session_id
    ? {
        sessionId: batchRow.session_id,
        batchId: batch.batchId,
        batchName: batch.name,
        attendanceDate: batchRow.session_date ?? today,
        totalStudents: batch.studentCount,
        presentCount: batchRow.present_count ?? 0,
        absentCount: batchRow.absent_count ?? 0,
        submittedAt: batchRow.submitted_at ?? '',
        verificationScheduledAt: batchRow.verification_scheduled_at ?? '',
        locked: true,
        idempotentReplay: false,
      }
    : null;

  return {
    batch,
    attendanceDate: batchRow.session_date ?? today,
    students,
    existingAttendance,
  };
}
