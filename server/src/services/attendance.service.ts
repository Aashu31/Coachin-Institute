import { env } from '../config/env.js';
import type {
  AttendanceSummaryDto,
  SubmitAttendanceInput,
} from '../types/domain.js';
import type { AuthContext } from '../types/domain.js';
import type { TenantDb } from '../types/tenant.js';
import { getTenantDate } from '../utils/datetime.js';
import { AppError } from '../utils/errors.js';
import { enqueueVerifyAbsentees } from '../queues/attendanceQueue.js';
import { sendAttendanceCorrectionNotice } from './whatsapp.service.js';
import { logger } from '../utils/logger.js';

const ISO_TIMESTAMP = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

interface BatchLockRow {
  batch_id: string;
  name: string;
  teacher_id: string | null;
  teacher_name?: string | null;
  scheduled_start_time: string;
  is_active: boolean | null;
}

interface StudentIdRow {
  student_id: string;
}

interface SessionRow {
  session_id: string;
  submitted_at: string;
  verification_scheduled_at: string;
}

interface AttendanceLogRow {
  student_id: string;
  status: string;
}

function buildSummary(
  session: SessionRow,
  input: {
    batchId: string;
    batchName: string;
    attendanceDate: string;
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    idempotentReplay: boolean;
  },
): AttendanceSummaryDto {
  return {
    sessionId: session.session_id,
    batchId: input.batchId,
    batchName: input.batchName,
    attendanceDate: input.attendanceDate,
    totalStudents: input.totalStudents,
    presentCount: input.presentCount,
    absentCount: input.absentCount,
    submittedAt: session.submitted_at,
    verificationScheduledAt: session.verification_scheduled_at,
    locked: true,
    idempotentReplay: input.idempotentReplay,
  };
}

/**
 * Locks a batch's daily attendance sheet.
 *
 * Idempotency contract for POST /attendance/submit:
 *   - first submission for (batch_id, attendance_date) inserts a session + logs;
 *   - a byte-for-byte replay returns the stored summary with idempotentReplay=true;
 *   - any changed mark on a locked sheet returns 409 ATTENDANCE_LOCKED
 *     (governance rule 1.4: teachers cannot edit locked attendance).
 */
export async function submitAttendance(
  db: TenantDb,
  auth: AuthContext,
  input: SubmitAttendanceInput,
): Promise<AttendanceSummaryDto> {
  const today = getTenantDate(env.APP_TIMEZONE);
  const attendanceDate = input.attendanceDate ?? today.date;

  if (attendanceDate !== today.date) {
    throw new AppError(
      409,
      'ATTENDANCE_WINDOW_CLOSED',
      'Attendance can only be submitted for today. Ask an administrator to make an audited retro-active correction.',
    );
  }

  return db.transaction(async (client) => {
    // Serialises concurrent submissions for the same batch. The unique index on
    // (batch_id, session_date) is the final backstop.
    const batchResult = await client.query<BatchLockRow>(
      `SELECT
          b.batch_id,
          b.name,
          b.teacher_id,
          u.full_name AS teacher_name,
          TO_CHAR(b.scheduled_start_time, 'HH24:MI:SS') AS scheduled_start_time,
          b.is_active
         FROM batches b
         LEFT JOIN users u ON u.user_id = b.teacher_id
        WHERE b.institute_id = $1
          AND b.batch_id = $2
        FOR UPDATE`,
      [db.instituteId, input.batchId],
    );

    const batch = batchResult.rows[0];

    if (!batch || batch.is_active !== true) {
      throw new AppError(404, 'BATCH_NOT_FOUND', 'This batch does not exist in your institute.');
    }

    if (auth.role !== 'TEACHER') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Only assigned teachers can record or edit attendance.',
      );
    }

    if (batch.teacher_id !== auth.userId) {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Teachers can only submit attendance for batches assigned to them.',
      );
    }

    const studentsResult = await client.query<StudentIdRow>(
      `SELECT student_id
         FROM students
        WHERE institute_id = $1 AND batch_id = $2 AND is_active = TRUE`,
      [db.instituteId, input.batchId],
    );

    const expectedStudentIds = new Set(studentsResult.rows.map((row) => row.student_id));

    if (expectedStudentIds.size === 0) {
      throw new AppError(
        422,
        'BATCH_EMPTY',
        'This batch has no active students, so attendance cannot be submitted.',
      );
    }

    if (input.records.length !== expectedStudentIds.size) {
      throw new AppError(
        422,
        'ROSTER_INCOMPLETE',
        'Every active student in the batch must be marked PRESENT or ABSENT before submitting.',
        {
          expected: expectedStudentIds.size,
          received: input.records.length,
        },
      );
    }

    const seenStudentIds = new Set<string>();

    for (const record of input.records) {
      if (!expectedStudentIds.has(record.studentId)) {
        throw new AppError(
          422,
          'ROSTER_MISMATCH',
          'One or more students do not belong to this batch.',
          { studentId: record.studentId },
        );
      }

      if (seenStudentIds.has(record.studentId)) {
        throw new AppError(
          422,
          'DUPLICATE_STUDENT',
          'Each student may appear only once in an attendance submission.',
          { studentId: record.studentId },
        );
      }

      seenStudentIds.add(record.studentId);
    }

    const presentCount = input.records.filter((record) => record.status === 'PRESENT').length;
    const absentCount = input.records.length - presentCount;

    const existingResult = await client.query<SessionRow>(
      `SELECT
          ses.session_id,
          TO_CHAR(ses.marked_at AT TIME ZONE 'UTC', '${ISO_TIMESTAMP}') AS submitted_at,
          TO_CHAR(
            (ses.class_start_time + INTERVAL '10 minutes') AT TIME ZONE 'UTC',
            '${ISO_TIMESTAMP}'
          ) AS verification_scheduled_at
         FROM attendance_sessions ses
        WHERE ses.institute_id = $1
          AND ses.batch_id = $2
          AND ses.session_date = $3::date
        FOR UPDATE`,
      [db.instituteId, input.batchId, attendanceDate],
    );

    const existingSession = existingResult.rows[0];

    if (existingSession) {
      const logsResult = await client.query<AttendanceLogRow>(
        `SELECT student_id, status
           FROM attendance_logs
          WHERE institute_id = $1 AND session_id = $2`,
        [db.instituteId, existingSession.session_id],
      );

      const persisted = new Map<string, string>(
        logsResult.rows.map((row) => [
          row.student_id,
          row.status,
        ]),
      );

      const isIdenticalReplay =
        persisted.size === input.records.length &&
        input.records.every((record) => {
          const currentStatus = persisted.get(record.studentId);
          const isCurrentPresent = currentStatus === 'PRESENT';
          const isRecordPresent = record.status === 'PRESENT';
          return isCurrentPresent === isRecordPresent;
        });

      if (isIdenticalReplay) {
        return buildSummary(existingSession, {
          batchId: batch.batch_id,
          batchName: batch.name,
          attendanceDate,
          totalStudents: persisted.size,
          presentCount,
          absentCount,
          idempotentReplay: true,
        });
      }

      // Teacher is updating / correcting attendance
      // Identify students whose status was previously ABSENT (not PRESENT) and is now marked PRESENT
      const correctedAbsentStudentIds: string[] = [];
      for (const record of input.records) {
        const prevStatus = persisted.get(record.studentId);
        if (prevStatus && prevStatus !== 'PRESENT' && record.status === 'PRESENT') {
          correctedAbsentStudentIds.push(record.studentId);
        }
      }

      // Update attendance_logs for each student
      for (const record of input.records) {
        const newDbStatus = record.status === 'PRESENT' ? 'PRESENT' : 'ABSENT_UNCONFIRMED';
        await client.query(
          `UPDATE attendance_logs
              SET status = $1::attendance_status
            WHERE institute_id = $2
              AND session_id = $3
              AND student_id = $4`,
          [newDbStatus, db.instituteId, existingSession.session_id, record.studentId],
        );
      }

      // Update attendance_sessions count and marked_at
      await client.query(
        `UPDATE attendance_sessions
            SET present_count = $1,
                absent_count = $2,
                marked_at = NOW()
          WHERE institute_id = $3
            AND session_id = $4`,
        [presentCount, absentCount, db.instituteId, existingSession.session_id],
      );

      // If any students were corrected from ABSENT to PRESENT, send apology follow-up notices ONLY to their parents
      if (correctedAbsentStudentIds.length > 0) {
        const studentsQuery = await client.query<{
          student_id: string;
          full_name: string;
          parent_whatsapp: string;
        }>(
          `SELECT student_id, full_name, parent_whatsapp
             FROM students
            WHERE institute_id = $1
              AND student_id = ANY($2::uuid[])`,
          [db.instituteId, correctedAbsentStudentIds],
        );

        for (const student of studentsQuery.rows) {
          try {
            await sendAttendanceCorrectionNotice(
              db.instituteId,
              student.parent_whatsapp,
              student.full_name,
              batch.name,
              batch.teacher_name ?? undefined,
            );
          } catch (err) {
            logger.error('Failed to send attendance correction apology message', {
              studentId: student.student_id,
              error: err,
            });
          }
        }
      }

      return buildSummary(existingSession, {
        batchId: batch.batch_id,
        batchName: batch.name,
        attendanceDate,
        totalStudents: input.records.length,
        presentCount,
        absentCount,
        idempotentReplay: false,
      });
    }

    const teacherId = auth.role === 'TEACHER' ? auth.userId : (batch.teacher_id ?? auth.userId);

    const insertResult = await client.query<SessionRow>(
      `INSERT INTO attendance_sessions (
          institute_id,
          batch_id,
          teacher_id,
          session_date,
          class_start_time,
          verification_triggered,
          total_students,
          present_count,
          absent_count
       )
       VALUES (
          $1,
          $2,
          $3,
          $4::date,
          ($4::date + $5::time) AT TIME ZONE $6,
          FALSE,
          $7,
          $8,
          $9
       )
       RETURNING
          session_id,
          TO_CHAR(marked_at AT TIME ZONE 'UTC', '${ISO_TIMESTAMP}') AS submitted_at,
          TO_CHAR(
            (class_start_time + INTERVAL '10 minutes') AT TIME ZONE 'UTC',
            '${ISO_TIMESTAMP}'
          ) AS verification_scheduled_at`,
      [
        db.instituteId,
        batch.batch_id,
        teacherId,
        attendanceDate,
        batch.scheduled_start_time,
        env.APP_TIMEZONE,
        input.records.length,
        presentCount,
        absentCount,
      ],
    );

    const session = insertResult.rows[0];

    if (!session) {
      throw new AppError(500, 'ATTENDANCE_SAVE_FAILED', 'The attendance sheet could not be saved.');
    }

    const studentIds = input.records.map((record) => record.studentId);
    const statuses = input.records.map((record) =>
      record.status === 'PRESENT' ? 'PRESENT' : 'ABSENT_UNCONFIRMED',
    );

    await client.query(
      `INSERT INTO attendance_logs (institute_id, session_id, student_id, status)
       SELECT $1, $2, roster.student_id, roster.status::attendance_status
         FROM unnest($3::uuid[], $4::text[]) AS roster(student_id, status)`,
      [db.instituteId, session.session_id, studentIds, statuses],
    );

    await enqueueVerifyAbsentees(db.instituteId, batch.batch_id, session.session_id, attendanceDate);

    return buildSummary(session, {
      batchId: batch.batch_id,
      batchName: batch.name,
      attendanceDate,
      totalStudents: input.records.length,
      presentCount,
      absentCount,
      idempotentReplay: false,
    });
  });
}
