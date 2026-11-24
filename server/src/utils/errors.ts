import { ZodError } from 'zod';

/**
 * Application-level error carrying the HTTP status and the stable error code
 * required by governance rule 3.6 (unified JSON error envelope).
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export function formatZodIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.') || '(root)',
    message: issue.message,
  }));
}

export function validationError(error: ZodError): AppError {
  return new AppError(422, 'VALIDATION_ERROR', 'The request payload failed validation.', formatZodIssues(error));
}
