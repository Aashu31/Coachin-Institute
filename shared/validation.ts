/**
 * Shared Zod validation schemas for both server and client.
 * Ensures consistent validation and human-readable error messages across the stack.
 */
import { z } from 'zod';

/**
 * Indian mobile number regex: 10 digits starting with 6-9, optionally prefixed with +91
 * Examples: 9876543210, +919876543210, 919876543210
 */
export const indianPhoneRegex = /^(\+91|91)?[6-9]\d{9}$/;

/**
 * Normalizes Indian phone to +91XXXXXXXXXX format for storage
 */
export function normalizeIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+91${digits.slice(2)}`;
  if (digits.length === 13 && digits.startsWith('+91')) return digits;
  return phone; // Return as-is if can't normalize, validation will catch it
}

/**
 * Human-readable error messages for common validation failures
 */
export const validationMessages = {
  required: (field: string) => `${field} is required`,
  email: (field: string) => `Enter a valid email address for ${field}`,
  phone: 'Enter a valid 10-digit Indian mobile number starting with 6–9 (e.g., 9876543210)',
  minLength: (field: string, min: number) => `${field} must be at least ${min} characters`,
  maxLength: (field: string, max: number) => `${field} must not exceed ${max} characters`,
  passwordMismatch: 'Passwords do not match',
  confirmationMismatch: (field: string) => `${field} does not match`,
  invalidSlug: 'Slug must contain only lowercase letters, numbers, and hyphens',
  invalidDate: 'Enter a valid date',
  futureDate: 'Date cannot be in the future',
  positiveNumber: (field: string) => `${field} must be a positive number`,
  atLeastOne: (field: string) => `Select at least one ${field}`,
};

/**
 * Common field validators
 */
export const emailField = (fieldName = 'Email') =>
  z.string().trim().min(1, validationMessages.required(fieldName)).email(validationMessages.email(fieldName)).max(255);

export const passwordField = (fieldName = 'Password', min = 8, max = 128) =>
  z.string().min(min, validationMessages.minLength(fieldName, min)).max(max, validationMessages.maxLength(fieldName, max));

export const phoneField = (fieldName = 'Phone', required = true) => {
  const base = z.string().trim().regex(indianPhoneRegex, validationMessages.phone);
  return required ? base.min(1, validationMessages.required(fieldName)) : base.optional().or(z.literal(''));
};

export const nameField = (fieldName = 'Name', min = 2, max = 255) =>
  z.string().trim().min(min, validationMessages.minLength(fieldName, min)).max(max, validationMessages.maxLength(fieldName, max));

export const slugField = (fieldName = 'Slug') =>
  z.string().trim().min(2, validationMessages.minLength(fieldName, 2)).max(100, validationMessages.maxLength(fieldName, 100))
    .regex(/^[a-z0-9-]+$/, validationMessages.invalidSlug);

export const addressField = (fieldName = 'Address', min = 5, max = 500) =>
  z.string().trim().min(min, validationMessages.minLength(fieldName, min)).max(max, validationMessages.maxLength(fieldName, max));

export const cityField = (fieldName = 'City', min = 2, max = 100) =>
  z.string().trim().min(min, validationMessages.minLength(fieldName, min)).max(max, validationMessages.maxLength(fieldName, max));

export const notesField = (fieldName = 'Notes', max = 500, required = false) => {
  const base = z.string().trim().max(max, validationMessages.maxLength(fieldName, max));
  return required ? base.min(1, validationMessages.required(fieldName)) : base.optional().or(z.literal(''));
};

/**
 * Role enum (must match server USER_ROLES)
 */
export const userRoleEnum = z.enum(['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'TEACHER', 'RECEPTIONIST']);

export const leadTargetCourseEnum = z.enum(['CAT', 'CLASS_12_PCM']);
export const leadPreferredSlotEnum = z.enum(['MORNING', 'EVENING', 'WEEKEND']);
export const leadStatusEnum = z.enum(['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'ENROLLED', 'LOST']);

/**
 * Login schema
 */
export const loginSchema = z.object({
  email: emailField('Email'),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Register institute onboarding schemas (3 steps)
 * Base schemas without refinements for safe merging/extending
 */
const registerStep1BaseSchema = z.object({
  adminFullName: nameField('Full name'),
  adminEmail: emailField('Email'),
  adminPhone: phoneField('Mobile number'),
  adminPassword: passwordField('Password'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
});

const registerStep2BaseSchema = z.object({
  instituteName: nameField('Institute name'),
  instituteSlug: slugField('Institute slug'),
  institutePhone: phoneField('Institute phone'),
  instituteEmail: emailField('Institute email'),
  instituteAddress: addressField('Address'),
  instituteCity: cityField('City'),
});

const registerStep3BaseSchema = z.object({
  batchName: nameField('Batch name'),
  targetCourse: leadTargetCourseEnum,
  scheduledStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Enter a valid time (HH:MM)'),
  scheduledEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Enter a valid time (HH:MM)'),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1, 'Select at least one day'),
  roomNumber: z.string().trim().max(50).optional().or(z.literal('')),
});

/**
 * Step schemas with refinements applied after base schema
 */
export const registerStep1Schema = registerStep1BaseSchema.refine(
  (data) => data.adminPassword === data.confirmPassword,
  { message: validationMessages.passwordMismatch, path: ['confirmPassword'] }
);

export const registerStep2Schema = registerStep2BaseSchema;

export const registerStep3Schema = registerStep3BaseSchema;

/**
 * Combined schema using extend (Zod v4 compatible)
 * First extend base schemas, then apply refinements
 */
export const registerInstituteSchema = registerStep1BaseSchema
  .extend(registerStep2BaseSchema.shape)
  .extend(registerStep3BaseSchema.shape)
  .refine((data) => data.adminPassword === data.confirmPassword, {
    message: validationMessages.passwordMismatch,
    path: ['confirmPassword'],
  });

/**
 * Email verification
 */
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const resendVerificationSchema = z.object({
  email: emailField('Email'),
});

/**
 * Password reset
 */
export const forgotPasswordSchema = z.object({
  email: emailField('Email'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordField('New password'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: validationMessages.passwordMismatch,
  path: ['confirmPassword'],
});

/**
 * Profile management
 */
export const updateProfileSchema = z.object({
  fullName: nameField('Full name').optional(),
  phone: phoneField('Phone', false).optional(),
  avatarInitials: z.string().trim().max(3).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordField('New password'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: validationMessages.passwordMismatch,
  path: ['confirmPassword'],
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirmation: z.string().refine((val) => val === 'DELETE', 'You must type DELETE to confirm'),
});

/**
 * Demo lead (public website)
 */
export const demoLeadSchema = z.object({
  studentName: nameField('Student name'),
  phone: phoneField('Parent/Student mobile'),
  targetCourse: leadTargetCourseEnum,
  preferredSlot: leadPreferredSlotEnum,
  notes: notesField('Additional notes', 500, false),
  instituteSlug: z.string().trim().min(1).optional(),
});

/**
 * Admin batch management
 */
export const createBatchSchema = z.object({
  name: nameField('Batch name'),
  targetExam: leadTargetCourseEnum,
  teacherId: z.string().uuid().nullable().optional(),
  scheduledStartTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Enter a valid time (HH:MM:SS)'),
  scheduledEndTime: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Enter a valid time (HH:MM:SS)'),
  daysOfWeek: z.array(z.number().int().min(1).max(7)).min(1, 'Select at least one day'),
  roomNumber: z.string().trim().max(50).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateBatchSchema = createBatchSchema.partial();

/**
 * Admin student management
 */
export const createStudentSchema = z.object({
  fullName: nameField('Full name'),
  rollNumber: z.string().trim().min(1, 'Roll number is required').max(50, 'Roll number too long'),
  parentName: nameField('Parent name'),
  parentWhatsapp: phoneField('Parent WhatsApp'),
  parentSecondaryPhone: phoneField('Secondary phone', false).nullable().optional(),
  batchId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateStudentSchema = createStudentSchema.partial();

/**
 * CSV bulk import row schema
 */
export const bulkImportStudentRowSchema = z.object({
  fullName: nameField('Full name'),
  rollNumber: z.string().trim().min(1, 'Roll number is required').max(50),
  parentName: nameField('Parent name'),
  parentWhatsapp: phoneField('Parent WhatsApp'),
  parentSecondaryPhone: phoneField('Secondary phone', false).nullable().optional(),
  batchId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Lead status update
 */
export const updateLeadStatusSchema = z.object({
  status: leadStatusEnum,
  notes: notesField('Notes', 1000, false),
});

/**
 * Escalation resolution
 */
export const resolveEscalationSchema = z.object({
  taskId: z.string().uuid('Invalid task ID'),
  callOutcome: z.enum(['VERIFIED_SICK', 'BUNK_CONFIRMED', 'LINE_UNREACHABLE']),
  staffNotes: z.string().trim().min(1, 'Staff notes are required').max(1000, 'Notes too long'),
});

/**
 * Attendance submission
 */
export const attendanceRecordSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  status: z.enum(['PRESENT', 'ABSENT']),
});

export const submitAttendanceSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  attendanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
  records: z.array(attendanceRecordSchema).min(1, 'At least one attendance record required'),
});

/**
 * Format Zod errors into human-readable field-level messages
 */
export function formatZodError(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'form';
    if (!fieldErrors[path]) {
      fieldErrors[path] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Get the first error message from a Zod error
 */
export function getFirstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Validation failed';
}

/**
 * Transform ZodError to ApiError-like structure for consistent error handling
 */
export function zodErrorToApiError(error: z.ZodError): { code: string; message: string; details: Record<string, string> } {
  return {
    code: 'VALIDATION_ERROR',
    message: 'The request payload failed validation.',
    details: formatZodError(error),
  };
}