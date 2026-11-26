import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { buildWhatsAppUrl } from '../utils/phone.js';

interface ButtonComponent {
  type: 'button';
  sub_type: 'quick_reply';
  index: string;
  parameters: Array<{ type: 'payload'; payload: string }>;
}

interface BodyComponent {
  type: 'body';
  parameters: Array<{ type: 'text'; text: string }>;
}

interface WhatsAppMessagePayload {
  to: string;
  templateName: string;
  languageCode: string;
  components: Array<BodyComponent | ButtonComponent>;
}

function buildInteractiveTemplate(
  studentName: string,
  batchName: string,
  classStartTime: string,
  logId: string,
): WhatsAppMessagePayload {
  const formattedTime = new Date(classStartTime).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });

  return {
    to: '',
    templateName: 'attendance_alert',
    languageCode: 'en',
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: studentName },
          { type: 'text', text: batchName },
          { type: 'text', text: formattedTime },
        ],
      },
      {
        type: 'button',
        sub_type: 'quick_reply',
        index: '0',
        parameters: [{ type: 'payload', payload: `BTN_LEAVE_${logId}` }],
      },
      {
        type: 'button',
        sub_type: 'quick_reply',
        index: '1',
        parameters: [{ type: 'payload', payload: `BTN_LATE_${logId}` }],
      },
      {
        type: 'button',
        sub_type: 'quick_reply',
        index: '2',
        parameters: [{ type: 'payload', payload: `BTN_BUNK_${logId}` }],
      },
    ],
  };
}

export async function sendWhatsAppVerification(
  instituteId: string,
  parentWhatsapp: string,
  studentName: string,
  batchName: string,
  classStartTime: string,
  logId: string,
): Promise<string> {
  const cleanNumber = parentWhatsapp.replace(/^\+/, '');

  if (env.WHATSAPP_MOCK_MODE) {
    const mockMessageId = `mock_${Date.now()}_${logId.slice(0, 8)}`;
    logger.info('[MOCK WHATSAPP] Verification message sent', {
      instituteId,
      to: parentWhatsapp,
      studentName,
      batchName,
      classStartTime,
      logId,
      messageId: mockMessageId,
      template: 'attendance_alert',
      buttons: ['On Leave', 'Running Late', 'Sent to Class'],
    });

    const deepLink = buildWhatsAppUrl(
      cleanNumber,
      `P.D.O Classes: ${studentName} marked absent in ${batchName} (${formattedTime(classStartTime)}). Reply: On Leave / Running Late / Sent to Class`,
    );
    logger.info('[MOCK WHATSAPP] Deep link for manual testing', { deepLink });

    return mockMessageId;
  }

  const payload = buildInteractiveTemplate(studentName, batchName, classStartTime, logId);
  payload.to = cleanNumber;

  const url = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `WhatsApp API error: ${response.status} ${response.statusText} - ${errorBody}`,
    );
  }

  const data = (await response.json()) as { messages: Array<{ id: string }> };
  const messageId = data.messages?.[0]?.id;

  if (!messageId) {
    throw new Error('WhatsApp API did not return a message ID');
  }

  logger.info('WhatsApp verification sent', {
    instituteId,
    to: parentWhatsapp,
    messageId,
  });

  return messageId;
}

export async function sendAttendanceCorrectionNotice(
  instituteId: string,
  parentWhatsapp: string,
  studentName: string,
  batchName: string,
  teacherName?: string,
): Promise<string> {
  const cleanNumber = parentWhatsapp.replace(/^\+/, '');
  const teacherSign = teacherName ? ` (${teacherName})` : '';
  const messageText = `Attendance Correction Notice - P.D.O Classes: Dear Parent, due to an accidental clerical mistake by the teacher${teacherSign}, your ward ${studentName} was previously marked absent. Their attendance has now been corrected to PRESENT for today's ${batchName} class. We sincerely apologize for the inconvenience and will ensure greater care in the future. - P.D.O Classes`;

  if (env.WHATSAPP_MOCK_MODE) {
    const mockMessageId = `mock_corr_${Date.now()}_${cleanNumber.slice(-4)}`;
    logger.info('[MOCK WHATSAPP] Attendance correction apology message sent', {
      instituteId,
      to: parentWhatsapp,
      studentName,
      batchName,
      messageId: mockMessageId,
      messageText,
    });

    const deepLink = buildWhatsAppUrl(cleanNumber, messageText);
    logger.info('[MOCK WHATSAPP] Deep link for correction notice', { deepLink });
    return mockMessageId;
  }

  const url = `https://graph.facebook.com/v20.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: cleanNumber,
      type: 'text',
      text: { body: messageText },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.warn('WhatsApp API correction notice error', { status: response.status, errorBody });
    return `error_${response.status}`;
  }

  const data = (await response.json()) as { messages?: Array<{ id: string }> };
  const messageId = data.messages?.[0]?.id || `corr_${Date.now()}`;
  logger.info('WhatsApp attendance correction notice sent successfully', {
    instituteId,
    to: parentWhatsapp,
    messageId,
  });
  return messageId;
}

function formattedTime(classStartTime: string): string {
  return new Date(classStartTime).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

export async function verifyWebhookSignature(
  payload: string,
  signature: string,
): Promise<boolean> {
  if (env.WHATSAPP_MOCK_MODE) {
    return true;
  }

  const crypto = await import('node:crypto');
  const expectedSignature = crypto
    .createHmac('sha256', env.WHATSAPP_APP_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex'),
  );
}