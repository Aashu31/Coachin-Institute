import { env } from '../config/env.js';
import { createTenantDb, pool } from '../db/pool.js';
import type {
  DemoLeadInput,
  DemoLeadResult,
  LeadPreferredSlot,
  LeadTargetCourse,
} from '../types/domain.js';
import { AppError } from '../utils/errors.js';
import { buildWhatsAppUrl, normalizeIndianMobile } from '../utils/phone.js';

const COURSE_LABELS: Readonly<Record<LeadTargetCourse, string>> = {
  CAT: 'CAT / MBA',
  CLASS_12_PCM: 'Class 11–12 PCM',
};

const SLOT_LABELS: Readonly<Record<LeadPreferredSlot, string>> = {
  MORNING: 'Morning',
  EVENING: 'Evening',
  WEEKEND: 'Weekend',
};

interface PublicInstituteRow {
  institute_id: string;
  name: string;
  slug: string;
  phone: string;
  address: string;
  city: string;
  is_active: boolean;
}

interface InsertedLeadRow {
  lead_id: string;
  created_at: string;
}

/**
 * Public demo-booking intake.
 *
 * The visitor has no JWT, so the institute is resolved through the narrow
 * SECURITY DEFINER bridge added in migration 002. The lead itself is inserted
 * through a tenant-scoped transaction, keeping RLS enforced for the write.
 */
export async function createDemoLead(input: DemoLeadInput): Promise<DemoLeadResult> {
  const slug = (input.instituteSlug ?? env.PUBLIC_INSTITUTE_SLUG).trim().toLowerCase();

  const instituteResult = await pool.query<PublicInstituteRow>(
    'SELECT * FROM public_institute_by_slug($1)',
    [slug],
  );

  const institute = instituteResult.rows[0];

  if (!institute || !institute.is_active) {
    throw new AppError(
      404,
      'INSTITUTE_NOT_FOUND',
      'Demo booking is not available for this institute right now.',
    );
  }

  const whatsappNumber = normalizeIndianMobile(input.phone);
  const notes = input.notes?.trim() ? input.notes.trim() : null;

  const db = createTenantDb(institute.institute_id);

  const insertResult = await db.query<InsertedLeadRow>(
    `INSERT INTO leads (
        institute_id,
        student_name,
        whatsapp_number,
        target_course,
        preferred_slot,
        status,
        notes
     )
     VALUES ($1, $2, $3, $4, $5, 'NEW', $6)
     RETURNING
        lead_id,
        TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at`,
    [
      institute.institute_id,
      input.studentName,
      whatsappNumber,
      input.targetCourse,
      input.preferredSlot,
      notes,
    ],
  );

  const lead = insertResult.rows[0];

  if (!lead) {
    throw new AppError(500, 'LEAD_SAVE_FAILED', 'The demo booking could not be saved.');
  }

  const firstName = input.studentName.split(' ')[0] ?? input.studentName;
  const courseLabel = COURSE_LABELS[input.targetCourse];
  const slotLabel = SLOT_LABELS[input.preferredSlot];

  const staffMessage =
    `Hello ${institute.name}, I just booked a free demo class for ${input.studentName} ` +
    `(${courseLabel}, ${slotLabel} slot).`;

  return {
    leadId: lead.lead_id,
    studentName: input.studentName,
    targetCourse: input.targetCourse,
    preferredSlot: input.preferredSlot,
    status: 'NEW',
    createdAt: lead.created_at,
    whatsappUrl: buildWhatsAppUrl(institute.phone, staffMessage),
    message: `Thank you, ${firstName}. Our team will call you within 24 hours to confirm your free demo class for ${courseLabel}.`,
  };
}
