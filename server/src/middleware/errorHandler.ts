import type { ErrorRequestHandler, RequestHandler } from 'express';

import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
    details?: unknown;
  };
}

interface PostgresErrorLike {
  code: string;
  constraint?: string;
  detail?: string;
}

function isPostgresErrorLike(error: unknown): error is PostgresErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  );
}

function isBodyParserError(error: unknown): error is { type: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    typeof (error as { type?: unknown }).type === 'string'
  );
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (isBodyParserError(error)) {
    if (error.type === 'entity.parse.failed') {
      return new AppError(400, 'INVALID_JSON', 'The request body is not valid JSON.');
    }

    if (error.type === 'entity.too.large') {
      return new AppError(413, 'PAYLOAD_TOO_LARGE', 'The request body exceeds the 1 MB limit.');
    }
  }

  if (isPostgresErrorLike(error)) {
    switch (error.code) {
      case '23505':
        return new AppError(
          409,
          'CONFLICT',
          'A record with the same unique value already exists.',
          { constraint: error.constraint ?? null },
        );
      case '23503':
        return new AppError(
          409,
          'FOREIGN_KEY_VIOLATION',
          'The referenced record does not exist or is still in use.',
          { constraint: error.constraint ?? null },
        );
      case '22P02':
        return new AppError(400, 'INVALID_INPUT', 'A supplied value could not be parsed.');
      case '42501':
        return new AppError(
          403,
          'TENANT_SCOPE_VIOLATION',
          'The requested operation is outside the active tenant scope.',
        );
      default:
        break;
    }
  }

  return new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `No route matches ${req.method} ${req.originalUrl}.`));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, next): void => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const appError = toAppError(error);

  if (appError.statusCode >= 500) {
    logger.error('Unhandled request error', {
      method: req.method,
      path: req.originalUrl,
      message: error instanceof Error ? error.message : String(error),
      stack: env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
    });
  }

  const envelope: ErrorEnvelope = {
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
      timestamp: new Date().toISOString(),
    },
  };

  if (appError.details !== undefined) {
    envelope.error.details = appError.details;
  }

  res.status(appError.statusCode).json(envelope);
};
