import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { USER_ROLES, type AuthContext } from '../types/domain.js';

export const accessTokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  institute_id: z.string().uuid(),
  role: z.enum(USER_ROLES),
  type: z.literal('access'),
});

export type AccessTokenPayload = z.infer<typeof accessTokenPayloadSchema>;

/**
 * Verifies the Bearer token, rejects refresh tokens on API routes and attaches
 * the tenant context to the request. Stateless: nothing is stored in Node
 * process memory (governance rule 3.5).
 */
export const authMiddleware: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');

  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    next(
      new AppError(401, 'UNAUTHENTICATED', 'A valid Bearer token is required for this resource.'),
    );
    return;
  }

  const token = header.slice(7).trim();

  if (token.length === 0) {
    next(new AppError(401, 'UNAUTHENTICATED', 'A valid Bearer token is required for this resource.'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });

    if (typeof decoded === 'string') {
      throw new AppError(401, 'INVALID_TOKEN', 'The access token payload is malformed.');
    }

    const parsed = accessTokenPayloadSchema.safeParse(decoded);

    if (!parsed.success) {
      throw new AppError(401, 'INVALID_TOKEN', 'The access token payload is malformed.');
    }

    const context: AuthContext = {
      userId: parsed.data.sub,
      instituteId: parsed.data.institute_id,
      role: parsed.data.role,
    };

    req.auth = context;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AppError(401, 'TOKEN_EXPIRED', 'The access token has expired. Please refresh it.'));
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError(401, 'INVALID_TOKEN', 'The access token is invalid.'));
      return;
    }

    next(error);
  }
};

/** Role guard factory for RBAC on individual routes. */
export function roleGuard(...allowedRoles: AuthContext['role'][]): RequestHandler {
  return (req, _res, next): void => {
    const auth = req.auth;

    if (!auth) {
      next(new AppError(401, 'UNAUTHENTICATED', 'Authentication is required.'));
      return;
    }

    if (!allowedRoles.includes(auth.role)) {
      next(
        new AppError(403, 'FORBIDDEN', 'Your role is not permitted to perform this action.'),
      );
      return;
    }

    next();
  };
}
