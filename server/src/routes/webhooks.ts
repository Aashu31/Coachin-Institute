import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';

import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import { createTenantDb } from '../db/pool.js';
import type { TenantDb } from '../types/tenant.js';
import { emitAttendanceStatusUpdate } from '../services/socket.service.js';
import { getRedisClient } from '../queues/redis.js';

export const webhookRouter = Router();

const webhookVerificationSchema = z.object({
  'hub.mode': z.string(),
  'hub.challenge': z.string(),
  'hub.verify_token': z.string(),
});

webhookRouter.get(
  '/whatsapp',
  asyncHandler(async (req, res) => {
    const parsed = webhookVerificationSchema.safeParse(req.query);

    if (!parsed.success) {
      throw new AppError(400, 'INVALID_WEBHOOK_PARAMS', 'Missing required verification parameters');
    }

    const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': verifyToken } = parsed.data;

    if (mode !== 'subscribe' || verifyToken !== env.WHATSAPP_VERIFY_TOKEN) {
      logger.warn('WhatsApp webhook verification failed', { mode, verifyToken });
      throw new AppError(403, 'VERIFICATION_FAILED', 'Invalid verify token');
    }

    logger.info('WhatsApp webhook verified successfully');
    res.status(200).send(challenge);
  }),
);

interface WhatsAppButtonPayload {
  payload: string;
}

interface WhatsAppMessage {
  from: string;
  type: string;
  id?: string; // wamid - Meta's message ID
  button?: WhatsAppButtonPayload;
}

interface WhatsAppChange {
  value: {
    messages?: WhatsAppMessage[];
    contacts?: Array<{ wa_id: string }>;
  };
}

interface WhatsAppEntry {
  changes: WhatsAppChange[];
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppEntry[];
}

function parseButtonPayload(payload: string): { action: string; logId: string } | null {
  const match = payload.match(/^BTN_(LEAVE|LATE|BUNK)_(.+)$/);
  if (!match || match.length < 3) return null;
  return { action: match[1]!, logId: match[2]! };
}

// Verify HMAC signature using timing-safe comparison
async function verifySignature(payload: string, signature: string): Promise<boolean> {
  if (env.WHATSAPP_MOCK_MODE) {
    return true;
  }

  const expectedSignature = crypto
    .createHmac('sha256', env.WHATSAPP_APP_SECRET)
    .update(payload)
    .digest('hex');

  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  // Use timingSafeEqual to prevent timing attacks
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

// Acquire Redis lock for idempotency using Meta's wamid
async function acquireWebhookLock(wamid: string): Promise<{ success: boolean; release: () => Promise<void> }> {
  const client = getRedisClient();
  const lockKey = `lock:wa_webhook:${wamid}`;
  // 60 second TTL as per governance rule 5.5
  const result = await client.set(lockKey, '1', 'PX', 60000, 'NX');
  if (result === 'OK') {
    let released = false;
    return {
      success: true,
      release: async () => {
        if (released) return;
        released = true;
        await client.del(lockKey);
      },
    };
  }
  return { success: false, release: async () => {} };
}

async function processButtonReply(
  db: TenantDb,
  parentWhatsapp: string,
  action: string,
  logId: string,
): Promise<{ success: boolean; newStatus: string }> {
  const cleanParentWhatsapp = parentWhatsapp.replace(/^\+/, '');

  const logResult = await db.query<{
    log_id: string;
    status: string;
    student_id: string;
    institute_id: string;
  }>(
    `SELECT log_id, status, student_id, institute_id
       FROM attendance_logs
      WHERE log_id = $1 AND institute_id = $2`,
    [logId, db.instituteId],
  );

  const log = logResult.rows[0];

  if (!log) {
    logger.warn('Attendance log not found for webhook', { logId, instituteId: db.instituteId });
    return { success: false, newStatus: 'NOT_FOUND' };
  }

  if (log.status !== 'ALERT_SENT' && log.status !== 'ESCALATION_CALL_REQUIRED') {
    logger.info('Attendance log already processed, skipping', {
      logId,
      currentStatus: log.status,
    });
    return { success: true, newStatus: log.status };
  }

  let newStatus: string;
  let escalationResolved = false;

  switch (action) {
    case 'LEAVE':
      newStatus = 'PARENT_VERIFIED_LEAVE';
      escalationResolved = true;
      break;
    case 'LATE':
      newStatus = 'PARENT_VERIFIED_LATE';
      escalationResolved = true;
      break;
    case 'BUNK':
      newStatus = 'PARENT_FLAGGED_BUNK';
      break;
    default:
      return { success: false, newStatus: 'INVALID_ACTION' };
  }

  await db.query(
    `UPDATE attendance_logs
        SET status = $1,
            parent_response_raw = $2,
            parent_responded_at = CURRENT_TIMESTAMP
      WHERE log_id = $3`,
    [newStatus, action, logId],
  );

  if (escalationResolved) {
    await db.query(
      `UPDATE escalation_tasks
          SET resolved_at = CURRENT_TIMESTAMP,
              call_outcome = $1,
              staff_notes = $2
        WHERE log_id = $3 AND resolved_at IS NULL`,
      [newStatus === 'PARENT_VERIFIED_LEAVE' ? 'VERIFIED_SICK' : 'VERIFIED_SICK', `Parent replied via WhatsApp: ${action}`, logId],
    );
  }

  await emitAttendanceStatusUpdate(db.instituteId, {
    type: 'ATTENDANCE_STATUS_UPDATED',
    logId,
    studentId: log.student_id,
    batchId: '',
    previousStatus: log.status,
    newStatus,
    updatedAt: new Date().toISOString(),
  });

  logger.info('Parent reply processed via webhook', {
    logId,
    action,
    newStatus,
    parentWhatsapp: cleanParentWhatsapp,
  });

  return { success: true, newStatus };
}

webhookRouter.post(
  '/whatsapp',
  asyncHandler(async (req, res): Promise<void> => {
    const rawBody = (req as any).rawBody ?? JSON.stringify(req.body);
    const signature = req.header('x-hub-signature-256')?.replace('sha256=', '');

    // Verify HMAC signature
    if (!env.WHATSAPP_MOCK_MODE && signature) {
      const isValid = await verifySignature(rawBody, signature);
      if (!isValid) {
        logger.warn('Invalid WhatsApp webhook signature');
        throw new AppError(401, 'INVALID_SIGNATURE', 'Invalid webhook signature');
      }
    }

    const payload = req.body as WhatsAppWebhookPayload;

    if (payload.object !== 'whatsapp_business_account') {
      logger.warn('Unknown webhook object type', { object: payload.object });
      res.status(200).send('OK');
      return;
    }

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.value.messages) {
          for (const message of change.value.messages) {
            if (message.type === 'button' && message.button?.payload) {
              const parsed = parseButtonPayload(message.button.payload);
              if (!parsed) {
                logger.warn('Unrecognized button payload', { payload: message.button.payload });
                continue;
              }

              // Idempotency: use Meta's message ID (wamid) to prevent replay attacks
              const wamid = message.id;
              if (wamid) {
                const lock = await acquireWebhookLock(wamid);
                if (!lock.success) {
                  logger.info('Duplicate webhook ignored (idempotent)', { wamid });
                  continue;
                }
                // Release lock after processing
                try {
                  const db = createTenantDb('');
                  const parentWhatsapp = message.from ?? '';
                  await processButtonReply(db, parentWhatsapp, parsed.action, parsed.logId);
                } finally {
                  await lock.release();
                }
              } else {
                // Fallback if no wamid
                const db = createTenantDb('');
                const parentWhatsapp = message.from ?? '';
                await processButtonReply(db, parentWhatsapp, parsed.action, parsed.logId);
              }
            }
          }
        }
      }
    }

    res.status(200).send('OK');
  }),
);