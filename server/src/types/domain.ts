export const USER_ROLES = ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'TEACHER', 'RECEPTIONIST'] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** Claims extracted from a verified access token and attached to the request. */
export interface AuthContext {
  userId: string;
  instituteId: string;
  role: UserRole;
}

/** Safe, client-facing representation of a staff account (never the hash). */
export interface AuthUserDto {
  userId: string;
  instituteId: string;
  instituteName: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface LoginResult {
  user: AuthUserDto;
  tokens: TokenPair;
}

/* ========================================================================== */
/* Phase 1: batches, attendance and public demo leads                         */
/* ========================================================================== */

export const ATTENDANCE_MARKS = ['PRESENT', 'ABSENT'] as const;

/** Teacher-facing mark. Persisted as PRESENT or ABSENT_UNCONFIRMED. */
export type AttendanceMark = (typeof ATTENDANCE_MARKS)[number];

export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT_UNCONFIRMED'
  | 'ALERT_SENT'
  | 'PARENT_VERIFIED_LEAVE'
  | 'PARENT_VERIFIED_LATE'
  | 'PARENT_FLAGGED_BUNK'
  | 'ESCALATION_CALL_REQUIRED'
  | 'CALL_RESOLVED';

export type AttendanceSheetStatus = 'SUBMITTED' | 'PENDING' | 'NOT_SCHEDULED';

export type LeadTargetCourse = 'CAT' | 'CLASS_12_PCM';

export type LeadPreferredSlot = 'MORNING' | 'EVENING' | 'WEEKEND';

export interface BatchSummaryDto {
  batchId: string;
  name: string;
  targetExam: string;
  teacherId: string | null;
  teacherName: string | null;
  scheduledStartTime: string;
  scheduledEndTime: string;
  daysOfWeek: number[];
  roomNumber: string | null;
  studentCount: number;
  isScheduledToday: boolean;
  attendanceStatus: AttendanceSheetStatus;
  sessionId: string | null;
  presentCount: number;
  absentCount: number;
  submittedAt: string | null;
}

export interface BatchListResult {
  batches: BatchSummaryDto[];
  today: string;
  timezone: string;
}

export interface AttendanceSummaryDto {
  sessionId: string;
  batchId: string;
  batchName: string;
  attendanceDate: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  submittedAt: string;
  verificationScheduledAt: string;
  locked: boolean;
  idempotentReplay: boolean;
}

export interface RosterStudentDto {
  studentId: string;
  fullName: string;
  rollNumber: string;
  /** Existing mark for today's sheet, or null when attendance is not taken yet. */
  status: AttendanceMark | null;
}

export interface BatchRosterResult {
  batch: BatchSummaryDto;
  attendanceDate: string;
  students: RosterStudentDto[];
  existingAttendance: AttendanceSummaryDto | null;
}

export interface AttendanceRecordInput {
  studentId: string;
  status: AttendanceMark;
}

export interface SubmitAttendanceInput {
  batchId: string;
  attendanceDate?: string;
  records: AttendanceRecordInput[];
}

export interface DemoLeadInput {
  studentName: string;
  phone: string;
  targetCourse: LeadTargetCourse;
  preferredSlot: LeadPreferredSlot;
  notes?: string;
  instituteSlug?: string;
}

export interface DemoLeadResult {
  leadId: string;
  studentName: string;
  targetCourse: LeadTargetCourse;
  preferredSlot: LeadPreferredSlot;
  status: 'NEW';
  createdAt: string;
  whatsappUrl: string;
  message: string;
}

/* ========================================================================== */
/* Phase 3: Admin management types                                           */
/* ========================================================================== */

export type LeadStatus = 'NEW' | 'CONTACTED' | 'DEMO_SCHEDULED' | 'ENROLLED' | 'LOST';

export interface AdminLeadDto {
  leadId: string;
  studentName: string;
  whatsappNumber: string;
  targetCourse: LeadTargetCourse;
  preferredSlot: LeadPreferredSlot | null;
  status: LeadStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadListResult {
  leads: AdminLeadDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpdateLeadStatusInput {
  status: LeadStatus;
  notes?: string;
}

export interface AdminBatchDto {
  batchId: string;
  name: string;
  targetExam: string;
  teacherId: string | null;
  teacherName: string | null;
  scheduledStartTime: string;
  scheduledEndTime: string;
  daysOfWeek: number[];
  roomNumber: string | null;
  isActive: boolean;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BatchListResultAdmin {
  batches: AdminBatchDto[];
  total: number;
}

export interface CreateBatchInput {
  name: string;
  targetExam: LeadTargetCourse;
  teacherId: string | null;
  scheduledStartTime: string; // HH:MM:SS
  scheduledEndTime: string;   // HH:MM:SS
  daysOfWeek: number[];
  roomNumber: string | null;
  isActive?: boolean;
}

export interface UpdateBatchInput {
  name?: string;
  targetExam?: LeadTargetCourse;
  teacherId?: string | null;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  daysOfWeek?: number[];
  roomNumber?: string | null;
  isActive?: boolean;
}

export interface AdminStudentDto {
  studentId: string;
  fullName: string;
  rollNumber: string;
  parentName: string;
  parentWhatsapp: string;
  parentSecondaryPhone: string | null;
  batchId: string | null;
  batchName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudentListResult {
  students: AdminStudentDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateStudentInput {
  fullName: string;
  rollNumber: string;
  parentName: string;
  parentWhatsapp: string;
  parentSecondaryPhone?: string | null;
  batchId: string | null;
  isActive?: boolean;
}

export interface UpdateStudentInput {
  fullName?: string;
  rollNumber?: string;
  parentName?: string;
  parentWhatsapp?: string;
  parentSecondaryPhone?: string | null;
  batchId?: string | null;
  isActive?: boolean;
}

export interface BulkStudentImportInput {
  students: CreateStudentInput[];
}

export interface BulkImportResult {
  created: number;
  updated: number;
  errors: Array<{ row: number; error: string; data: CreateStudentInput }>;
}

export interface DailyAttendanceReportDto {
  date: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  presentPercentage: number;
  batches: Array<{
    batchId: string;
    batchName: string;
    scheduledStartTime: string;
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    presentPercentage: number;
    avgParentResponseTimeMinutes: number | null;
    unresolvedRedAlerts: number;
  }>;
  avgParentResponseTimeMinutes: number | null;
  unresolvedRedAlerts: number;
}

