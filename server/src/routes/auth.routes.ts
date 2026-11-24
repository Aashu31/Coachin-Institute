import { Router } from 'express';
import { z } from 'zod';

import {
  loginWithPassword,
  refreshSession,
  logout,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  registerInstituteAndAdmin,
  getCurrentUser,
  updateProfile,
  changePassword,
  deleteAccount,
} from '../services/auth.service.js';
import { requireAuthContext, requireTenantDb } from '../types/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validationError } from '../utils/errors.js';

export const authRouter = Router();

// ---- Validation schemas -----------------------------------------------------

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const resendVerificationSchema = z.object({
  email: z.string().trim().email().max(255),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(255),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const registerInstituteSchema = z.object({
  instituteName: z.string().trim().min(2).max(255),
  instituteSlug: z.string().trim().toLowerCase().min(2).max(100).regex(/^[a-z0-9-]+$/),
  institutePhone: z.string().trim().min(10).max(20),
  instituteEmail: z.string().trim().email().max(255),
  instituteAddress: z.string().trim().min(5).max(500),
  instituteCity: z.string().trim().min(2).max(100),
  adminFullName: z.string().trim().min(2).max(255),
  adminEmail: z.string().trim().email().max(255),
  adminPhone: z.string().trim().min(10).max(20),
  adminPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine((data) => data.adminPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(255).optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  avatarInitials: z.string().trim().max(3).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const deleteAccountSchema = z.object({
  password: z.string().min(1),
  confirmation: z.string().refine((val) => val === 'DELETE', 'You must type DELETE to confirm'),
});

// ---- Public routes (no auth required) --------------------------------------

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const result = await loginWithPassword(parsed.data.email, parsed.data.password);

    // Set refresh token as httpOnly cookie for browser clients
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    res.status(200).json({ success: true, data: result });
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    // Accept refresh token from body or cookie
    const refreshToken = req.body.refresh_token ?? req.cookies?.refreshToken;

    if (!refreshToken) {
      throw validationError({ issues: [{ path: ['refresh_token'], message: 'Refresh token is required' }] } as any);
    }

    const result = await refreshSession(refreshToken);

    // Set new refresh token cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(200).json({ success: true, data: result });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    // Accept refresh token from body or cookie
    const refreshToken = req.body.refresh_token ?? req.cookies?.refreshToken;

    if (refreshToken) {
      await logout(refreshToken);
    }

    // Clear the cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
    });

    res.status(200).json({ success: true, data: { message: 'Logged out successfully' } });
  }),
);

authRouter.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const parsed = verifyEmailSchema.safeParse(req.body);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const result = await verifyEmail(parsed.data.token);

    res.status(200).json({
      success: true,
      data: {
        message: result.was_already_verified ? 'Email was already verified' : 'Email verified successfully',
        alreadyVerified: result.was_already_verified,
      },
    });
  }),
);

authRouter.post(
  '/resend-verification',
  asyncHandler(async (req, res) => {
    const parsed = resendVerificationSchema.safeParse(req.body);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    // Always returns 200 to prevent email enumeration
    await resendVerificationEmail(parsed.data.email);

    res.status(200).json({
      success: true,
      data: { message: 'If the email exists and is not verified, a new verification link has been sent.' },
    });
  }),
);

authRouter.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    // Always returns 200 to prevent email enumeration
    await forgotPassword(parsed.data.email);

    res.status(200).json({
      success: true,
      data: { message: 'If the email exists, a password reset link has been sent.' },
    });
  }),
);

authRouter.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    await resetPassword(parsed.data.token, parsed.data.password);

    res.status(200).json({
      success: true,
      data: { message: 'Password has been reset successfully. You can now log in.' },
    });
  }),
);

// Self-serve institute onboarding
authRouter.post(
  '/register-institute',
  asyncHandler(async (req, res) => {
    const parsed = registerInstituteSchema.safeParse(req.body);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const result = await registerInstituteAndAdmin(parsed.data);

    res.status(201).json({
      success: true,
      data: {
        instituteId: result.institute_id,
        userId: result.user_id,
        message: 'Institute and admin account created. Please check your email to verify your account.',
      },
    });
  }),
);

// ---- Protected routes (require JWT + tenant context) -----------------------

/** Mounted by the app behind authMiddleware + tenantContext. */
export const meHandler = asyncHandler(async (req, res) => {
  const auth = requireAuthContext(req.auth);
  const db = requireTenantDb(req.db);

  const user = await getCurrentUser(db, auth.userId);

  res.status(200).json({ success: true, data: { user } });
});

authRouter.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req.auth);
    const db = requireTenantDb(req.db);

    const parsed = updateProfileSchema.safeParse(req.body);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const user = await updateProfile(db, auth.userId, parsed.data);

    res.status(200).json({ success: true, data: { user } });
  }),
);

authRouter.post(
  '/profile/change-password',
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req.auth);
    const db = requireTenantDb(req.db);

    const parsed = changePasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    await changePassword(db, auth.userId, parsed.data.currentPassword, parsed.data.newPassword);

    res.status(200).json({
      success: true,
      data: { message: 'Password changed successfully. You will be logged out of other sessions.' },
    });
  }),
);

authRouter.delete(
  '/profile/account',
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req.auth);
    const db = requireTenantDb(req.db);

    const parsed = deleteAccountSchema.safeParse(req.body);

    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    const result = await deleteAccount(db, auth.userId, parsed.data.password, parsed.data.confirmation);

    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
    });

    res.status(200).json({
      success: true,
      data: {
        message: result.instituteDeactivated
          ? 'Your account and institute have been deactivated.'
          : 'Your account has been deleted.',
        wasSoleAdmin: result.wasSoleAdmin,
        instituteDeactivated: result.instituteDeactivated,
      },
    });
  }),
);