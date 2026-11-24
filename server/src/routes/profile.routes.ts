import { Router } from 'express';
import { z } from 'zod';

import {
  getCurrentUser,
  updateProfile,
  changePassword,
  deleteAccount,
} from '../services/auth.service.js';
import { requireAuthContext, requireTenantDb } from '../types/tenant.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { validationError } from '../utils/errors.js';

export const profileRouter = Router();

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

// All routes in this router require authentication + tenant context
// They are mounted under /api/v1/profile in app.ts

profileRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const auth = requireAuthContext(req.auth);
    const db = requireTenantDb(req.db);

    const user = await getCurrentUser(db, auth.userId);

    res.status(200).json({ success: true, data: { user } });
  }),
);

profileRouter.patch(
  '/',
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

profileRouter.post(
  '/change-password',
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

profileRouter.delete(
  '/account',
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