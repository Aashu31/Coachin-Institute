import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { getRedisClient, disconnectRedis } from './redis.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { createTenantDb } from '../db/pool.js';
import type { TenantDb } from '../types/tenant.js';
import { sendWhatsAppVerification } from '../services/whatsapp.service.js';
import { createEscalationTask } from '../services/escalation.service.js';
import { emitEscalationAlert } from '../services/socket.service.js';

let verifyAbsenteesQueue: Queue<VerifyAbsenteesJobData> | null = null;
let checkParentReplyQueue: Queue<CheckParentReplyJobData> | null = null;
let verifyAbsenteesEvents: QueueEvents | null = null;
let checkParentReplyEvents: QueueEvents | null = null;
let verifyAbsenteesWorker: Worker<VerifyAbsenteesJobData> | null = null;
let checkParentReplyWorker: Worker<CheckParentReplyJobData> | null = null;
let redisAvailable = false;

export interface VerifyAbsenteesJobData {
  instituteId: string;
  batchId: string;
  sessionId: string;
  attendanceDate: string;
}

export interface CheckParentReplyJobData {
  instituteId: string;
  logId: string;
  batchId: string;
  studentId: string;
  parentWhatsapp: string;
}

function initializeQueues(): void {
  if (redisAvailable) return;

  (async (): Promise<void> => {
    try {
      const redisClient = getRedisClient();
      await redisClient.connect();

      // Check Redis version compatibility BEFORE creating any BullMQ objects.
      // BullMQ requires Redis 5.0+. If we have v3.x, skip queues entirely to
      // avoid BullMQ's internal retry loops from polluting the logs.
      const info = await redisClient.info();
      const versionMatch = info.match(/redis_version:(\d+)\.(\d+)/);
      if (versionMatch) {
        const major = Number(versionMatch[1]);
        const minor = Number(versionMatch[2]);
        if (major < 5 || (major === 5 && minor < 0)) {
          throw new Error(
            `Redis v${major}.${minor} is incompatible with BullMQ (requires v5.0+)`,
          );
        }
      }

      verifyAbsenteesQueue = new Queue<VerifyAbsenteesJobData>(
        'verify-absentees',
        { connection: redisClient },
      );

      checkParentReplyQueue = new Queue<CheckParentReplyJobData>(
        'check-parent-reply',
        { connection: redisClient },
      );

      verifyAbsenteesEvents = new QueueEvents('verify-absentees', {
        connection: redisClient,
      });

      checkParentReplyEvents = new QueueEvents('check-parent-reply', {
        connection: redisClient,
      });

      redisAvailable = true;

      verifyAbsenteesEvents?.on('completed', ({ jobId }) => {
        logger.info('verify-absentees job completed', { jobId });
      });

      verifyAbsenteesEvents?.on('failed', ({ jobId, failedReason }) => {
        logger.error('verify-absentees job failed', { jobId, failedReason });
      });

      checkParentReplyEvents?.on('completed', ({ jobId }) => {
        logger.info('check-parent-reply job completed', { jobId });
      });

      checkParentReplyEvents?.on('failed', ({ jobId, failedReason }) => {
        logger.error('check-parent-reply job failed', { jobId, failedReason });
      });

      logger.info('BullMQ queues initialized successfully');
    } catch (error) {
      redisAvailable = false;
      verifyAbsenteesQueue = null;
      checkParentReplyQueue = null;
      verifyAbsenteesEvents = null;
      checkParentReplyEvents = null;
      verifyAbsenteesWorker = null;
      checkParentReplyWorker = null;
      // Close all Redis connections to stop BullMQ's internal retry loops.
      void disconnectRedis().catch(() => {
        // Ignore disconnect errors during cleanup
      });
      logger.warn('Redis not available - BullMQ queues disabled', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}

// Initialize queues immediately
initializeQueues();

export interface VerifyAbsenteesJobData {
  instituteId: string;
  batchId: string;
  sessionId: string;
  attendanceDate: string;
}

export interface CheckParentReplyJobData {
  instituteId: string;
  logId: string;
  batchId: string;
  studentId: string;
  parentWhatsapp: string;
}

// Export getters for lazy access
export function getVerifyAbsenteesQueue(): Queue<VerifyAbsenteesJobData> | null {
  return verifyAbsenteesQueue;
}

export function getCheckParentReplyQueue(): Queue<CheckParentReplyJobData> | null {
  return checkParentReplyQueue;
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

async function getTenantDbForJob(instituteId: string): Promise<TenantDb> {
  return createTenantDb(instituteId);
}

async function processVerifyAbsentees(job: Job<VerifyAbsenteesJobData>): Promise<void> {
  const { instituteId, batchId, sessionId, attendanceDate } = job.data;
  const db = await getTenantDbForJob(instituteId);

  logger.info('Processing verify-absentees job', {
    instituteId,
    batchId,
    sessionId,
    attendanceDate,
  });

  const absentLogsResult = await db.query<{
    log_id: string;
    student_id: string;
    parent_whatsapp: string;
    student_name: string;
    batch_name: string;
    class_start_time: string;
  }>(
    `SELECT
        al.log_id,
        al.student_id,
        s.parent_whatsapp,
        s.full_name AS student_name,
        b.name AS batch_name,
        TO_CHAR(ses.class_start_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS class_start_time
      FROM attendance_logs al
      JOIN students s ON s.student_id = al.student_id
      JOIN attendance_sessions ses ON ses.session_id = al.session_id
      JOIN batches b ON b.batch_id = ses.batch_id
     WHERE al.institute_id = $1
       AND al.session_id = $2
       AND al.status = 'ABSENT_UNCONFIRMED'`,
    [instituteId, sessionId],
  );

  if (absentLogsResult.rows.length === 0) {
    logger.info('No unconfirmed absent students to verify', { sessionId });
    return;
  }

  const sessionInfoResult = await db.query<{
    class_start_time: string;
    verification_triggered: boolean;
  }>(
    `SELECT class_start_time, verification_triggered
       FROM attendance_sessions
      WHERE session_id = $1 AND institute_id = $2`,
    [sessionId, instituteId],
  );

  if (sessionInfoResult.rows[0]?.verification_triggered) {
    logger.info('Verification already triggered for this session', { sessionId });
    return;
  }

  await db.query(
    `UPDATE attendance_sessions SET verification_triggered = TRUE WHERE session_id = $1`,
    [sessionId],
  );

  for (const log of absentLogsResult.rows) {
    try {
      const messageId = await sendWhatsAppVerification(
        instituteId,
        log.parent_whatsapp,
        log.student_name,
        log.batch_name,
        log.class_start_time,
        log.log_id,
      );

      await db.query(
        `UPDATE attendance_logs
            SET status = 'ALERT_SENT',
                whatsapp_message_id = $1,
                whatsapp_sent_at = CURRENT_TIMESTAMP
          WHERE log_id = $2`,
        [messageId, log.log_id],
      );

      const replyQueue = getCheckParentReplyQueue();
      if (replyQueue) {
        await replyQueue.add(
        'check-parent-reply',
        {
          instituteId,
          logId: log.log_id,
          batchId,
          studentId: log.student_id,
          parentWhatsapp: log.parent_whatsapp,
        },
        {
          delay: env.PARENT_REPLY_WINDOW_MS,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      } // if (replyQueue)

      logger.info('WhatsApp verification sent and check-parent-reply job enqueued', {
        logId: log.log_id,
        messageId,
        parentWhatsapp: log.parent_whatsapp,
      });
    } catch (error) {
      logger.error('Failed to send WhatsApp verification', {
        logId: log.log_id,
        error: error instanceof Error ? error.message : String(error),
      });

      await db.query(
        `UPDATE attendance_logs SET status = 'ABSENT_UNCONFIRMED' WHERE log_id = $1`,
        [log.log_id],
      );
    }
  }
}

async function processCheckParentReply(job: Job<CheckParentReplyJobData>): Promise<void> {
  const { instituteId, logId, batchId, studentId, parentWhatsapp } = job.data;
  const db = await getTenantDbForJob(instituteId);

  logger.info('Processing check-parent-reply job', { logId, instituteId });

  const logResult = await db.query<{
    log_id: string;
    status: string;
    student_id: string;
    parent_whatsapp: string;
  }>(
    `SELECT log_id, status, student_id, parent_whatsapp
       FROM attendance_logs
      WHERE log_id = $1 AND institute_id = $2`,
    [logId, instituteId],
  );

  const log = logResult.rows[0];

  if (!log) {
    logger.warn('Attendance log not found for check-parent-reply', { logId });
    return;
  }

  if (log.status !== 'ALERT_SENT') {
    logger.info('Parent already replied or status changed, skipping escalation', {
      logId,
      status: log.status,
    });
    return;
  }

  await db.query(
    `UPDATE attendance_logs SET status = 'ESCALATION_CALL_REQUIRED' WHERE log_id = $1`,
    [logId],
  );

  const escalationTask = await createEscalationTask(db, logId, studentId, instituteId);

  await emitEscalationAlert(instituteId, {
    type: 'RED_ALERT',
    taskId: escalationTask.task_id,
    studentId,
    batchId,
    parentWhatsapp,
    triggeredAt: new Date().toISOString(),
  });

  logger.warn('Red Alert escalated - no parent reply within window', {
    logId,
    taskId: escalationTask.task_id,
    instituteId,
  });
}

function initializeWorkers(): void {
  if (!redisAvailable) return;
  
  try {
    const redisClient = getRedisClient();
    
    verifyAbsenteesWorker = new Worker<VerifyAbsenteesJobData>(
      'verify-absentees',
      processVerifyAbsentees,
      {
        connection: redisClient,
        concurrency: 5,
      },
    );

    checkParentReplyWorker = new Worker<CheckParentReplyJobData>(
      'check-parent-reply',
      processCheckParentReply,
      {
        connection: redisClient,
        concurrency: 10,
      },
    );

    verifyAbsenteesWorker.on('error', (err) => {
      logger.error('verifyAbsenteesWorker error', { message: err.message });
    });

    checkParentReplyWorker.on('error', (err) => {
      logger.error('checkParentReplyWorker error', { message: err.message });
    });

    logger.info('BullMQ workers initialized successfully');
  } catch (error) {
    logger.warn('Failed to initialize workers', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// Initialize workers after queues
initializeWorkers();

export async function enqueueVerifyAbsentees(
  instituteId: string,
  batchId: string,
  sessionId: string,
  attendanceDate: string,
  delayMs?: number,
): Promise<void> {
  const queue = getVerifyAbsenteesQueue();
  if (!queue) {
    logger.warn('Cannot enqueue verify-absentees: Redis not available');
    return;
  }
  
  try {
    await queue.add(
      'verify-absentees',
      { instituteId, batchId, sessionId, attendanceDate },
      {
        delay: delayMs ?? env.ATTENDANCE_VERIFY_DELAY_MS,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  } catch (error) {
    logger.warn('Failed to enqueue verify-absentees job: Redis may be incompatible', {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function closeQueues(): Promise<void> {
  if (verifyAbsenteesWorker) await verifyAbsenteesWorker.close();
  if (checkParentReplyWorker) await checkParentReplyWorker.close();
  if (verifyAbsenteesQueue) await verifyAbsenteesQueue.close();
  if (checkParentReplyQueue) await checkParentReplyQueue.close();
  if (verifyAbsenteesEvents) await verifyAbsenteesEvents.close();
  if (checkParentReplyEvents) await checkParentReplyEvents.close();
}