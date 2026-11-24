import 'dotenv/config';
import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  APP_TIMEZONE: z.string().min(1).default('Asia/Kolkata'),
  CLIENT_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_MIGRATION_URL: z.string().min(1).optional(),
  DATABASE_SSL: booleanFromString.default(false),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().min(300).default(604_800),
  JWT_ISSUER: z.string().min(1).default('pdo-classes-api'),
  JWT_AUDIENCE: z.string().min(1).default('pdo-classes-client'),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  SEED_DEFAULT_PASSWORD: z.string().min(10).default('PdoClasses@2026'),

  /**
   * Tenant that owns the public marketing site and its demo-booking form.
   * Resolved through public_institute_by_slug() before a JWT exists.
   */
  PUBLIC_INSTITUTE_SLUG: z.string().min(1).max(100).default('pdo-classes'),

  WHATSAPP_PROVIDER: z.literal('META_CLOUD').default('META_CLOUD'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().default(''),
  WHATSAPP_ACCESS_TOKEN: z.string().default(''),
  WHATSAPP_VERIFY_TOKEN: z.string().default(''),
  WHATSAPP_APP_SECRET: z.string().default(''),

  // Escalation Engine Timers
  ATTENDANCE_VERIFY_DELAY_MS: z.coerce.number().int().min(1000).default(600_000),
  PARENT_REPLY_WINDOW_MS: z.coerce.number().int().min(1000).default(180_000),
  WHATSAPP_MOCK_MODE: booleanFromString.default(true),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');

  throw new Error(
    `Invalid server environment configuration:\n${details}\n\nCopy server/.env.example to server/.env and fill in the values.`,
  );
}

// Security hardening: WHATSAPP_MOCK_MODE must be false in production
if (parsed.data.NODE_ENV === 'production' && parsed.data.WHATSAPP_MOCK_MODE !== false) {
  throw new Error(
    'Security violation: WHATSAPP_MOCK_MODE must be false in production (NODE_ENV=production).'
  );
}

export const env = Object.freeze(parsed.data);

export type Env = typeof env;
