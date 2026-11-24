import type { TenantDb } from '../types/tenant.js';
import { logger } from '../utils/logger.js';

export interface EscalationTaskDto {
  task_id: string;
  institute_id: string;
  log_id: string;
  student_id: string;
  priority: string;
  triggered_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  call_outcome: string | null;
  staff_notes: string | null;
  student_name?: string;
  parent_whatsapp?: string;
  roll_number?: string;
  batch_name?: string;
  batch_id?: string;
  status?: string;
}

export async function createEscalationTask(
  db: TenantDb,
  logId: string,
  studentId: string,
  instituteId: string,
): Promise<EscalationTaskDto> {
  const result = await db.query<EscalationTaskDto>(
    `INSERT INTO escalation_tasks (institute_id, log_id, student_id, priority)
     VALUES ($1, $2, $3, 'CRITICAL')
     RETURNING
       task_id,
       institute_id,
       log_id,
       student_id,
       priority,
       TO_CHAR(triggered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS triggered_at,
       TO_CHAR(resolved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS resolved_at,
       resolved_by,
       call_outcome,
       staff_notes`,
    [instituteId, logId, studentId],
  );

  const task = result.rows[0];

  if (!task) {
    throw new Error('Failed to create escalation task');
  }

  logger.info('Escalation task created', {
    taskId: task.task_id,
    logId,
    studentId,
    instituteId,
  });

  return task;
}

export async function resolveEscalationTask(
  db: TenantDb,
  taskId: string,
  resolvedBy: string,
  callOutcome: 'VERIFIED_SICK' | 'BUNK_CONFIRMED' | 'LINE_UNREACHABLE',
  staffNotes: string,
): Promise<EscalationTaskDto> {
  const result = await db.query<EscalationTaskDto>(
    `UPDATE escalation_tasks
        SET resolved_at = CURRENT_TIMESTAMP,
            resolved_by = $1,
            call_outcome = $2,
            staff_notes = $3
      WHERE task_id = $4 AND resolved_at IS NULL
      RETURNING
        task_id,
        institute_id,
        log_id,
        student_id,
        priority,
        TO_CHAR(triggered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS triggered_at,
        TO_CHAR(resolved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS resolved_at,
        resolved_by,
        call_outcome,
        staff_notes`,
    [resolvedBy, callOutcome, staffNotes, taskId],
  );

  if (result.rows.length === 0) {
    throw new Error('Escalation task not found or already resolved');
  }

  const task = result.rows[0]!;

  await db.query(
    `UPDATE attendance_logs
        SET status = CASE
            WHEN $2 = 'VERIFIED_SICK' THEN 'PARENT_VERIFIED_LEAVE'
            WHEN $2 = 'BUNK_CONFIRMED' THEN 'PARENT_FLAGGED_BUNK'
            ELSE 'ESCALATION_CALL_REQUIRED'
          END
      WHERE log_id = (
        SELECT log_id FROM escalation_tasks WHERE task_id = $1
      )`,
    [taskId, callOutcome],
  );

  logger.info('Escalation task resolved', {
    taskId,
    callOutcome,
    resolvedBy,
  });

  return task;
}

export async function getActiveEscalationTasks(
  db: TenantDb,
): Promise<EscalationTaskDto[]> {
  const result = await db.query<EscalationTaskDto>(
    `SELECT
        et.task_id,
        et.institute_id,
        et.log_id,
        et.student_id,
        et.priority,
        TO_CHAR(et.triggered_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS triggered_at,
        TO_CHAR(et.resolved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS resolved_at,
        et.resolved_by,
        et.call_outcome,
        et.staff_notes,
        s.full_name AS student_name,
        s.parent_whatsapp,
        s.roll_number,
        b.name AS batch_name,
        b.batch_id,
        al.status
      FROM escalation_tasks et
      JOIN students s ON s.student_id = et.student_id
      JOIN attendance_logs al ON al.log_id = et.log_id
      JOIN attendance_sessions ses ON ses.session_id = al.session_id
      JOIN batches b ON b.batch_id = ses.batch_id
     WHERE et.institute_id = $1
       AND et.resolved_at IS NULL
     ORDER BY et.triggered_at ASC`,
    [db.instituteId],
  );

  return result.rows || [];
}