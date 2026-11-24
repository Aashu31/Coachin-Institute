import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import {
  USER_ROLES,
  type AuthUserDto,
  type LoginResult,
  type TokenPair,
  type UserRole,
} from '../types/domain.js';
import type { TenantDb } from '../types/tenant.js';
import { AppError } from '../utils/errors.js';

interface AuthLookupRow {
  user_id: string;
  institute_id: string;
  full_name: string;
  email: string;
  phone: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  institute_is_active: boolean;
  institute_name: string;
  last_login_at: Date | null;
  email_verified: boolean;
}

interface CurrentUserRow {
  user_id: string;
  institute_id: string;
  full_name: string;
  email: string;
  phone: string;
  role: UserRole;
  is_active: boolean | null;
  last_login_at: Date | null;
  institute_name: string;
  email_verified: boolean;
  avatar_initials: string | null;
}

interface RegisterInstituteResult {
  institute_id: string;
  user_id: string;
  verification_token: string;
}

interface VerifyEmailResult {
  user_id: string;
  institute_id: string;
  email: string;
  was_already_verified: boolean;
}

interface ResetPasswordResult {
  user_id: string;
  institute_id: string;
  email: string;
}

interface RefreshTokenValidationRow {
  user_id: string;
  institute_id: string;
  role: UserRole;
  is_active: boolean;
  institute_is_active: boolean;
}

const refreshTokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  institute_id: z.string().uuid(),
  role: z.enum(USER_ROLES),
  type: z.literal('refresh'),
});

type RefreshTokenPayload = z.infer<typeof refreshTokenPayloadSchema>;

function toAuthUser(row: AuthLookupRow | CurrentUserRow): AuthUserDto {
  return {
    userId: row.user_id,
    instituteId: row.institute_id,
    instituteName: row.institute_name,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    isActive: row.is_active ?? true,
    lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
  };
}

function toAuthUserWithVerification(row: CurrentUserRow): AuthUserDto & { emailVerified: boolean; avatarInitials: string | null } {
  return {
    ...toAuthUser(row),
    emailVerified: row.email_verified,
    avatarInitials: row.avatar_initials,
  };
}

function issueTokenPair(userId: string, instituteId: string, role: UserRole): TokenPair {
  const accessToken = jwt.sign(
    { institute_id: instituteId, role, type: 'access' },
    env.JWT_SECRET,
    {
      subject: userId,
      expiresIn: env.JWT_ACCESS_TTL_SECONDS,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    },
  );

  const refreshToken = jwt.sign(
    { institute_id: instituteId, role, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    {
      subject: userId,
      expiresIn: env.JWT_REFRESH_TTL_SECONDS,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    },
  );

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
  };
}

function assertAccountUsable(row: AuthLookupRow): void {
  if (!row.is_active) {
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'This staff account has been deactivated.');
  }

  if (!row.institute_is_active) {
    throw new AppError(403, 'INSTITUTE_INACTIVE', 'This institute is not active.');
  }

  // Block sensitive actions for unverified emails (except seeded P.D.O users)
  if (!row.email_verified) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email address before accessing this resource.');
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Login intentionally runs before a tenant context exists. The SECURITY DEFINER
 * function resolves the globally-unique email and returns only the columns
 * required for authentication.
 *
 * Issues a short-lived access JWT + stores hashed refresh token in DB.
 * The refresh token is returned to the client; in production the client should
 * receive it via an httpOnly cookie. For API compatibility we return it in
 * the response body as well.
 */
export async function loginWithPassword(email: string, password: string): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLowerCase();

  const result = await pool.query<AuthLookupRow>(
    'SELECT * FROM auth_lookup_user_by_email($1)',
    [normalizedEmail],
  );

  const row = result.rows[0];

  if (!row) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const passwordMatches = await bcrypt.compare(password, row.password_hash);

  if (!passwordMatches) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  assertAccountUsable(row);

  await pool.query('SELECT auth_record_login($1)', [row.user_id]);

  const tokens = issueTokenPair(row.user_id, row.institute_id, row.role);

  // Store hashed refresh token in DB for rotation/revocation
  const refreshTokenHash = hashToken(tokens.refreshToken);
  const refreshExpiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);
  await pool.query('SELECT auth_store_refresh_token($1, $2, $3)', [
    row.user_id,
    refreshTokenHash,
    refreshExpiresAt,
  ]);

  return {
    user: toAuthUser({ ...row, last_login_at: new Date() }),
    tokens,
  };
}

function verifyRefreshToken(token: string): RefreshTokenPayload {
  let decoded: string | jwt.JwtPayload;

  try {
    decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
  } catch {
    throw new AppError(
      401,
      'INVALID_REFRESH_TOKEN',
      'The refresh token is invalid or has expired.',
    );
  }

  if (typeof decoded === 'string') {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh token payload is malformed.');
  }

  const parsed = refreshTokenPayloadSchema.safeParse(decoded);

  if (!parsed.success) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh token payload is malformed.');
  }

  return parsed.data;
}

/**
 * Stateless rotation using DB-stored refresh tokens:
 * 1. Verify the JWT signature and claims
 * 2. Look up the hashed token in DB (must exist, not revoked, not expired)
 * 3. Re-read user from DB so deactivation takes effect immediately
 * 4. Revoke the old refresh token, issue new pair, store new hash
 */
export async function refreshSession(refreshToken: string): Promise<LoginResult> {
  const payload = verifyRefreshToken(refreshToken);

  // Validate against DB store
  const tokenHash = hashToken(refreshToken);
  const validation = await pool.query<RefreshTokenValidationRow>(
    'SELECT * FROM auth_validate_refresh_token($1)',
    [tokenHash],
  );

  const validRow = validation.rows[0];

  if (!validRow) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh token has been revoked or expired.');
  }

  // Re-read user from DB for current state
  const result = await pool.query<AuthLookupRow>('SELECT * FROM auth_lookup_user_by_id($1)', [
    payload.sub,
  ]);

  const row = result.rows[0];

  if (!row) {
    // Revoke the token since user no longer exists
    await pool.query('SELECT auth_revoke_refresh_token($1)', [tokenHash]);
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'The refresh token subject no longer exists.');
  }

  assertAccountUsable(row);

  // Revoke old refresh token (rotation)
  await pool.query('SELECT auth_revoke_refresh_token($1)', [tokenHash]);

  // Issue new token pair
  const tokens = issueTokenPair(row.user_id, row.institute_id, row.role);

  // Store new refresh token hash
  const newRefreshTokenHash = hashToken(tokens.refreshToken);
  const newRefreshExpiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_SECONDS * 1000);
  await pool.query('SELECT auth_store_refresh_token($1, $2, $3)', [
    row.user_id,
    newRefreshTokenHash,
    newRefreshExpiresAt,
  ]);

  return {
    user: toAuthUser(row),
    tokens,
  };
}

/**
 * Logout: revoke the specific refresh token in DB and clear the cookie.
 * The access token remains valid until expiry (stateless) but cannot be
 * refreshed once the refresh token is revoked.
 */
export async function logout(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await pool.query('SELECT auth_revoke_refresh_token($1)', [tokenHash]);
}

/**
 * Tenant-scoped profile lookup. Runs inside the RLS transaction created by
 * tenantContext and repeats the institute filter as defence in depth.
 */
export async function getCurrentUser(db: TenantDb, userId: string): Promise<AuthUserDto & { emailVerified: boolean; avatarInitials: string | null }> {
  const result = await db.query<CurrentUserRow>(
    `SELECT u.user_id, u.institute_id, u.full_name, u.email, u.phone, u.role,
            u.is_active, u.last_login_at, u.email_verified, u.avatar_initials,
            i.name AS institute_name
       FROM users u
       JOIN institutes i ON i.institute_id = u.institute_id
      WHERE u.user_id = $1 AND u.institute_id = $2
      LIMIT 1`,
    [userId, db.instituteId],
  );

  const row = result.rows[0];

  if (!row || row.is_active !== true) {
    throw new AppError(401, 'UNAUTHENTICATED', 'The authenticated account is no longer active.');
  }

  return toAuthUserWithVerification(row);
}

/**
 * Update profile (name, phone, avatar initials) within tenant context.
 */
export async function updateProfile(
  db: TenantDb,
  userId: string,
  data: { fullName?: string; phone?: string; avatarInitials?: string }
): Promise<AuthUserDto & { emailVerified: boolean; avatarInitials: string | null }> {
  const updates: string[] = [];
  const params: unknown[] = [userId, db.instituteId];
  let paramIdx = 3;

  if (data.fullName !== undefined) {
    updates.push(`full_name = $${paramIdx++}`);
    params.push(data.fullName);
  }
  if (data.phone !== undefined) {
    updates.push(`phone = $${paramIdx++}`);
    params.push(data.phone);
  }
  if (data.avatarInitials !== undefined) {
    updates.push(`avatar_initials = $${paramIdx++}`);
    params.push(data.avatarInitials);
  }

  if (updates.length === 0) {
    return getCurrentUser(db, userId);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');

  const result = await db.query<CurrentUserRow>(
    `UPDATE users SET ${updates.join(', ')}
     WHERE user_id = $1 AND institute_id = $2
     RETURNING user_id, institute_id, full_name, email, phone, role,
               is_active, last_login_at, email_verified, avatar_initials,
               (SELECT name FROM institutes WHERE institute_id = $2) AS institute_name`,
    params,
  );

  const row = result.rows[0];

  if (!row) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found in this institute.');
  }

  return toAuthUserWithVerification(row);
}

/**
 * Change password within tenant context.
 * Revokes all active refresh tokens for security.
 */
export async function changePassword(
  db: TenantDb,
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  // Get current password hash
  const result = await db.query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE user_id = $1 AND institute_id = $2',
    [userId, db.instituteId],
  );

  const row = result.rows[0];

  if (!row) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found in this institute.');
  }

  const matches = await bcrypt.compare(currentPassword, row.password_hash);

  if (!matches) {
    throw new AppError(401, 'INVALID_CURRENT_PASSWORD', 'The current password is incorrect.');
  }

  const newHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

  // Update password and revoke all refresh tokens
  await db.query(
    `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $2 AND institute_id = $3`,
    [newHash, userId, db.instituteId],
  );

  await pool.query('SELECT auth_revoke_all_refresh_tokens($1)', [userId]);
}

/**
 * Soft-delete / anonymize user account (DPDP Act compliance).
 * Requires typed confirmation "DELETE" + current password.
 * If sole INSTITUTE_ADMIN, cascades to institute deactivation.
 */
export async function deleteAccount(
  db: TenantDb,
  userId: string,
  password: string,
  confirmation: string
): Promise<{ wasSoleAdmin: boolean; instituteDeactivated: boolean }> {
  // Verify password first
  const result = await db.query<{ password_hash: string; role: UserRole }>(
    'SELECT password_hash, role FROM users WHERE user_id = $1 AND institute_id = $2',
    [userId, db.instituteId],
  );

  const row = result.rows[0];

  if (!row) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found in this institute.');
  }

  const matches = await bcrypt.compare(password, row.password_hash);

  if (!matches) {
    throw new AppError(401, 'INVALID_PASSWORD', 'The password is incorrect.');
  }

  // Call SECURITY DEFINER function for atomic soft-delete
  const delResult = await pool.query<{
    was_sole_admin: boolean;
    institute_deleted: boolean;
  }>('SELECT * FROM auth_soft_delete_user($1, $2)', [userId, confirmation]);

  const delRow = delResult.rows[0];

  if (!delRow) {
    throw new AppError(500, 'DELETE_FAILED', 'Account deletion failed.');
  }

  return {
    wasSoleAdmin: delRow.was_sole_admin,
    instituteDeactivated: delRow.institute_deleted,
  };
}

/**
 * Email verification: validates the hashed token via SECURITY DEFINER function.
 * Auto-verifies seeded P.D.O Classes users (already handled in migration).
 */
export async function verifyEmail(token: string): Promise<VerifyEmailResult> {
  const tokenHash = hashToken(token);

  const result = await pool.query<VerifyEmailResult>(
    'SELECT * FROM auth_verify_email($1)',
    [tokenHash],
  );

  const row = result.rows[0];

  if (!row) {
    throw new AppError(400, 'INVALID_VERIFICATION_TOKEN', 'The verification link is invalid or has expired.');
  }

  return row;
}

/**
 * Resend verification email (generates new token).
 */
export async function resendVerificationEmail(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  const result = await pool.query<AuthLookupRow>(
    'SELECT * FROM auth_lookup_user_by_email($1)',
    [normalizedEmail],
  );

  const row = result.rows[0];

  if (!row) {
    // Always return success to prevent email enumeration
    return;
  }

  if (row.email_verified) {
    // Already verified, nothing to do
    return;
  }

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await pool.query(
    `UPDATE users
     SET verification_token_hash = $1, verification_expires_at = $2
     WHERE user_id = $3`,
    [tokenHash, expiresAt, row.user_id],
  );

  // In development, log the token to console for testing
  if (env.NODE_ENV !== 'production') {
    console.log(`[DEV] Verification token for ${row.email}: ${rawToken}`);
  }

  // TODO: Send actual email via Nodemailer in production
  // await sendVerificationEmail(row.email, rawToken, row.full_name);
}

/**
 * Forgot password: always returns generic 200 OK to prevent email enumeration.
 * Generates a reset token and logs it to console in development.
 */
export async function forgotPassword(email: string): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  const result = await pool.query<AuthLookupRow>(
    'SELECT * FROM auth_lookup_user_by_email($1)',
    [normalizedEmail],
  );

  const row = result.rows[0];

  if (!row) {
    // Always return success to prevent email enumeration
    return;
  }

  const rawToken = generateToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await pool.query(
    `UPDATE users
     SET reset_token_hash = $1, reset_expires_at = $2
     WHERE user_id = $3`,
    [tokenHash, expiresAt, row.user_id],
  );

  // In development, log the token to console for testing
  if (env.NODE_ENV !== 'production') {
    console.log(`[DEV] Password reset token for ${row.email}: ${rawToken}`);
  }

  // TODO: Send actual email via Nodemailer in production
  // await sendResetPasswordEmail(row.email, rawToken, row.full_name);
}

/**
 * Reset password: validates expiry, updates bcrypt hash, revokes all refresh tokens.
 */
export async function resetPassword(token: string, newPassword: string): Promise<ResetPasswordResult> {
  const tokenHash = hashToken(token);
  const newHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);

  const result = await pool.query<ResetPasswordResult>(
    'SELECT * FROM auth_reset_password($1, $2)',
    [tokenHash, newHash],
  );

  const row = result.rows[0];

  if (!row) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'The reset link is invalid or has expired.');
  }

  return row;
}

/**
 * Self-serve onboarding: creates institute + INSTITUTE_ADMIN atomically.
 * Sends verification email (logged to console in dev).
 */
export async function registerInstituteAndAdmin(data: {
  instituteName: string;
  instituteSlug: string;
  institutePhone: string;
  instituteEmail: string;
  instituteAddress: string;
  instituteCity: string;
  adminFullName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
}): Promise<RegisterInstituteResult> {
  const passwordHash = await bcrypt.hash(data.adminPassword, env.BCRYPT_ROUNDS);

  const result = await pool.query<RegisterInstituteResult>(
    `SELECT * FROM register_institute_and_admin(
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
     )`,
    [
      data.instituteName,
      data.instituteSlug,
      data.institutePhone,
      data.instituteEmail,
      data.instituteAddress,
      data.instituteCity,
      data.adminFullName,
      data.adminEmail,
      data.adminPhone,
      passwordHash,
    ],
  );

  const row = result.rows[0];

  if (!row) {
    throw new AppError(500, 'REGISTRATION_FAILED', 'Institute registration failed.');
  }

  // In development, log the verification token to console
  if (env.NODE_ENV !== 'production') {
    console.log(`[DEV] Verification token for ${data.adminEmail}: ${row.verification_token}`);
  }

  // TODO: Send actual verification email via Nodemailer in production
  // await sendVerificationEmail(data.adminEmail, row.verification_token, data.adminFullName);

  return row;
}