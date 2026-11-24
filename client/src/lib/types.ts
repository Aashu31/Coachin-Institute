export const USER_ROLES = ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'TEACHER', 'RECEPTIONIST'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface AuthUser {
  userId: string;
  instituteId: string;
  instituteName: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  emailVerified?: boolean;
  avatarInitials?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface LoginResult {
  user: AuthUser;
  tokens: TokenPair;
}

export const ATTENDANCE_MARKS = ['PRESENT', 'ABSENT'] as const;

export type AttendanceMark = (typeof ATTENDANCE_MARKS)[number];

export type AttendanceSheetStatus = 'SUBMITTED' | 'PENDING' | 'NOT_SCHEDULED';

export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT_UNCONFIRMED'
  | 'ALERT_SENT'
  | 'PARENT_VERIFIED_LEAVE'
  | 'PARENT_VERIFIED_LATE'
  | 'PARENT_FLAGGED_BUNK'
  | 'ESCALATION_CALL_REQUIRED'
  | 'CALL_RESOLVED';

export type EscalationCallOutcome = 'VERIFIED_SICK' | 'BUNK_CONFIRMED' | 'LINE_UNREACHABLE';

export interface EscalationTask {
  taskId: string;
  instituteId: string;
  logId: string;
  studentId: string;
  studentName: string;
  studentRollNumber: string;
  parentWhatsapp: string;
  batchId: string;
  batchName: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  triggeredAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  callOutcome: EscalationCallOutcome | null;
  staffNotes: string | null;
  elapsedMinutes: number;
  status?: string;
}

export interface EscalationTasksResponse {
  tasks: EscalationTask[];
}

export interface ResolveEscalationInput {
  taskId: string;
  callOutcome: EscalationCallOutcome;
  staffNotes: string;
}

export type LeadTargetCourse = 'CAT' | 'CLASS_12_PCM';

export type LeadPreferredSlot = 'MORNING' | 'EVENING' | 'WEEKEND';

export interface BatchSummary {
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
  batches: BatchSummary[];
  today: string;
  timezone: string;
}

export interface AttendanceSummary {
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

export interface RosterStudent {
  studentId: string;
  fullName: string;
  rollNumber: string;
  status: AttendanceMark | null;
}

export interface BatchRosterResult {
  batch: BatchSummary;
  attendanceDate: string;
  students: RosterStudent[];
  existingAttendance: AttendanceSummary | null;
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

export interface HealthSnapshot {
  status: string;
  service: string;
  version: string;
  environment: string;
  timezone: string;
  database: string;
  databaseTime: string | null;
  latencyMs: number;
  uptimeSeconds: number;
}

/* ========================================================================== */
/* Phase 3: Admin management types                                           */
/* ========================================================================== */

export type LeadStatus = 'NEW' | 'CONTACTED' | 'DEMO_SCHEDULED' | 'ENROLLED' | 'LOST';

export interface AdminLead {
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
  leads: AdminLead[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpdateLeadStatusInput {
  status: LeadStatus;
  notes?: string;
}

export interface AdminBatch {
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
  batches: AdminBatch[];
  total: number;
}

export interface CreateBatchInput {
  name: string;
  targetExam: LeadTargetCourse;
  teacherId: string | null;
  scheduledStartTime: string;
  scheduledEndTime: string;
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

export interface AdminStudent {
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
  students: AdminStudent[];
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

export interface DailyAttendanceReport {
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
