import bcrypt from 'bcryptjs';

import { env } from '../config/env.js';
import type { UserRole } from '../types/domain.js';
import { logger } from '../utils/logger.js';
import { createMigrationPool } from './pool.js';

/**
 * Idempotent seed for the P.D.O Classes pilot tenant.
 *
 * - Institute is upserted on its unique slug.
 * - Staff are upserted on their unique email (demo passwords are reset to
 *   SEED_DEFAULT_PASSWORD on every run, intentionally).
 * - Batches use deterministic UUIDs and upsert on batch_id.
 * - Students upsert on the existing (institute_id, roll_number) constraint.
 *
 * Run as the database owner (pdo_migrator/postgres). The owner bypasses RLS;
 * the tenant GUC is still set so the script also behaves correctly if it is
 * ever run through a non-owner role.
 */

const INSTITUTE_ID = 'a0000000-0000-4000-8000-000000000001';
const INSTITUTE_SLUG = 'pdo-classes';

const CAT_BATCH_ID = 'c0000000-0000-4000-8000-000000000001';
const PCM_BATCH_ID = 'c0000000-0000-4000-8000-000000000002';

interface SeedUser {
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
}

interface SeedBatch {
  batchId: string;
  name: string;
  targetExam: string;
  startTime: string;
  endTime: string;
  daysOfWeek: string;
  roomNumber: string;
  teacherEmail: string;
}

interface SeedStudent {
  studentId: string;
  fullName: string;
  rollNumber: string;
  parentName: string;
  parentWhatsapp: string;
  parentSecondaryPhone: string | null;
  batchId: string;
}

const SEED_USERS: readonly SeedUser[] = [
  {
    userId: 'b0000000-0000-4000-8000-000000000001',
    fullName: 'Prakash Dev Ojha',
    email: 'admin@pdoclasses.in',
    phone: '+919835010001',
    role: 'INSTITUTE_ADMIN',
  },
  {
    userId: 'b0000000-0000-4000-8000-000000000002',
    fullName: 'Neha Kumari',
    email: 'reception@pdoclasses.in',
    phone: '+919835010002',
    role: 'RECEPTIONIST',
  },
  {
    userId: 'b0000000-0000-4000-8000-000000000003',
    fullName: 'Ananya Sinha',
    email: 'ananya.sinha@pdoclasses.in',
    phone: '+919835010003',
    role: 'TEACHER',
  },
  {
    userId: 'b0000000-0000-4000-8000-000000000004',
    fullName: 'Rakesh Verma',
    email: 'rakesh.verma@pdoclasses.in',
    phone: '+919835010004',
    role: 'TEACHER',
  },
];

const SEED_BATCHES: readonly SeedBatch[] = [
  {
    batchId: CAT_BATCH_ID,
    name: 'CAT 2026 Evening Batch',
    targetExam: 'CAT',
    startTime: '16:00:00',
    endTime: '18:00:00',
    daysOfWeek: '{1,2,3,4,5,6}',
    roomNumber: 'Room 201',
    teacherEmail: 'ananya.sinha@pdoclasses.in',
  },
  {
    batchId: PCM_BATCH_ID,
    name: 'Class 12 PCM Morning Batch',
    targetExam: 'CLASS_12_PCM',
    startTime: '08:00:00',
    endTime: '10:00:00',
    daysOfWeek: '{1,2,3,4,5,6}',
    roomNumber: 'Room 101',
    teacherEmail: 'rakesh.verma@pdoclasses.in',
  },
];

const SEED_STUDENTS: readonly SeedStudent[] = [
  {
    studentId: 'd0000000-0000-4000-8000-000000000001',
    fullName: 'Rahul Kumar',
    rollNumber: 'CAT-2026-001',
    parentName: 'Sanjeev Kumar',
    parentWhatsapp: '+919835112401',
    parentSecondaryPhone: '+919835112501',
    batchId: CAT_BATCH_ID,
  },
  {
    studentId: 'd0000000-0000-4000-8000-000000000002',
    fullName: 'Sneha Agarwal',
    rollNumber: 'CAT-2026-002',
    parentName: 'Sunita Agarwal',
    parentWhatsapp: '+919835112402',
    parentSecondaryPhone: null,
    batchId: CAT_BATCH_ID,
  },
  {
    studentId: 'd0000000-0000-4000-8000-000000000003',
    fullName: 'Aditya Mahto',
    rollNumber: 'CAT-2026-003',
    parentName: 'Ramesh Mahto',
    parentWhatsapp: '+919835112403',
    parentSecondaryPhone: null,
    batchId: CAT_BATCH_ID,
  },
  {
    studentId: 'd0000000-0000-4000-8000-000000000004',
    fullName: 'Priya Singh',
    rollNumber: 'PCM-12-001',
    parentName: 'Ajay Singh',
    parentWhatsapp: '+919835112404',
    parentSecondaryPhone: '+919835112504',
    batchId: PCM_BATCH_ID,
  },
  {
    studentId: 'd0000000-0000-4000-8000-000000000005',
    fullName: 'Karan Oraon',
    rollNumber: 'PCM-12-002',
    parentName: 'Lata Oraon',
    parentWhatsapp: '+919835112405',
    parentSecondaryPhone: null,
    batchId: PCM_BATCH_ID,
  },
  {
    studentId: 'd0000000-0000-4000-8000-000000000006',
    fullName: 'Fatima Ansari',
    rollNumber: 'PCM-12-003',
    parentName: 'Imran Ansari',
    parentWhatsapp: '+919835112406',
    parentSecondaryPhone: null,
    batchId: PCM_BATCH_ID,
  },
];

interface SeedCounts {
  users: number;
  batches: number;
  students: number;
}

const migrationPool = createMigrationPool();

async function seed(): Promise<void> {
  const client = await migrationPool.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_institute_id', $1, TRUE)", [INSTITUTE_ID]);

    const whatsappConfig = {
      provider: env.WHATSAPP_PROVIDER,
      phone_number_id: env.WHATSAPP_PHONE_NUMBER_ID,
      access_token: '',
      business_account_id: env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    };

    const instituteResult = await client.query<{ institute_id: string }>(
      `INSERT INTO institutes (
          institute_id, name, slug, phone, email, address, city, whatsapp_api_config,
          verification_delay_minutes, escalation_timeout_minutes, is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, TRUE)
       ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          phone = EXCLUDED.phone,
          email = EXCLUDED.email,
          address = EXCLUDED.address,
          city = EXCLUDED.city,
          is_active = TRUE
       RETURNING institute_id`,
      [
        INSTITUTE_ID,
        'P.D.O Classes',
        INSTITUTE_SLUG,
        '083404 06593',
        'admissions@pdoclasses.in',
        'Lalpur, Ranchi, Jharkhand 834001, India',
        'Ranchi',
        JSON.stringify(whatsappConfig),
        10,
        3,
      ],
    );

    const instituteId = instituteResult.rows[0]?.institute_id;

    if (!instituteId) {
      throw new Error('Institute upsert did not return an institute_id.');
    }

    await client.query("SELECT set_config('app.current_institute_id', $1, TRUE)", [instituteId]);

    const passwordHash = await bcrypt.hash(env.SEED_DEFAULT_PASSWORD, env.BCRYPT_ROUNDS);
    const teacherIds = new Map<string, string>();

    for (const user of SEED_USERS) {
      const initials = user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      const result = await client.query<{ user_id: string }>(
        `INSERT INTO users (
            user_id, institute_id, full_name, email, phone, password_hash, role, is_active, email_verified, avatar_initials
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE, $8)
         ON CONFLICT (email) DO UPDATE SET
            institute_id = EXCLUDED.institute_id,
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            password_hash = EXCLUDED.password_hash,
            role = EXCLUDED.role,
            is_active = TRUE,
            email_verified = TRUE,
            avatar_initials = EXCLUDED.avatar_initials
         RETURNING user_id`,
        [
          user.userId,
          instituteId,
          user.fullName,
          user.email,
          user.phone,
          passwordHash,
          user.role,
          initials,
        ],
      );

      const userId = result.rows[0]?.user_id;

      if (!userId) {
        throw new Error(`User upsert did not return a user_id for ${user.email}.`);
      }

      teacherIds.set(user.email, userId);
    }

    for (const batch of SEED_BATCHES) {
      const teacherId = teacherIds.get(batch.teacherEmail);

      if (!teacherId) {
        throw new Error(`No seeded teacher found for ${batch.teacherEmail}.`);
      }

      await client.query(
        `INSERT INTO batches (
            batch_id, institute_id, teacher_id, name, target_exam,
            scheduled_start_time, scheduled_end_time, days_of_week, room_number, is_active
         )
         VALUES ($1, $2, $3, $4, $5, $6::time, $7::time, $8::int[], $9, TRUE)
         ON CONFLICT (batch_id) DO UPDATE SET
            institute_id = EXCLUDED.institute_id,
            teacher_id = EXCLUDED.teacher_id,
            name = EXCLUDED.name,
            target_exam = EXCLUDED.target_exam,
            scheduled_start_time = EXCLUDED.scheduled_start_time,
            scheduled_end_time = EXCLUDED.scheduled_end_time,
            days_of_week = EXCLUDED.days_of_week,
            room_number = EXCLUDED.room_number,
            is_active = TRUE`,
        [
          batch.batchId,
          instituteId,
          teacherId,
          batch.name,
          batch.targetExam,
          batch.startTime,
          batch.endTime,
          batch.daysOfWeek,
          batch.roomNumber,
        ],
      );
    }

    for (const student of SEED_STUDENTS) {
      await client.query(
        `INSERT INTO students (
            student_id, institute_id, batch_id, full_name, roll_number,
            parent_name, parent_whatsapp, parent_secondary_phone, is_active
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
         ON CONFLICT (institute_id, roll_number) DO UPDATE SET
            batch_id = EXCLUDED.batch_id,
            full_name = EXCLUDED.full_name,
            parent_name = EXCLUDED.parent_name,
            parent_whatsapp = EXCLUDED.parent_whatsapp,
            parent_secondary_phone = EXCLUDED.parent_secondary_phone,
            is_active = TRUE`,
        [
          student.studentId,
          instituteId,
          student.batchId,
          student.fullName,
          student.rollNumber,
          student.parentName,
          student.parentWhatsapp,
          student.parentSecondaryPhone,
        ],
      );
    }

    const countsResult = await client.query<SeedCounts>(
      `SELECT
          (SELECT COUNT(*)::int FROM users WHERE institute_id = $1) AS users,
          (SELECT COUNT(*)::int FROM batches WHERE institute_id = $1) AS batches,
          (SELECT COUNT(*)::int FROM students WHERE institute_id = $1) AS students`,
      [instituteId],
    );

    await client.query('COMMIT');

    const counts = countsResult.rows[0];

    logger.info('Seed complete: P.D.O Classes tenant is ready', {
      instituteId,
      institute: 'P.D.O Classes (Lalpur, Ranchi)',
      users: counts?.users ?? 0,
      batches: counts?.batches ?? 0,
      students: counts?.students ?? 0,
    });

    logger.info('Demo accounts (password = SEED_DEFAULT_PASSWORD from server/.env)', {
      accounts: SEED_USERS.map((user) => ({ email: user.email, role: user.role })),
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

void seed()
  .catch((error: unknown) => {
    logger.error('Seed failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => {
    void migrationPool.end();
  });
