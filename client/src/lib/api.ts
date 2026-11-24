import type {
  AdminBatch,
  AdminLead,
  AdminStudent,
  AttendanceSummary,
  AuthUser,
  BatchListResult,
  BatchListResultAdmin,
  BatchRosterResult,
  BulkImportResult,
  CreateBatchInput,
  CreateStudentInput,
  DailyAttendanceReport,
  DemoLeadInput,
  DemoLeadResult,
  EscalationTask,
  EscalationTasksResponse,
  HealthSnapshot,
  LeadListResult,
  LoginResult,
  ResolveEscalationInput,
  StudentListResult,
  SubmitAttendanceInput,
  UpdateBatchInput,
  UpdateLeadStatusInput,
  UpdateStudentInput,
} from './types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

/** In-memory access token (not persisted to localStorage for XSS protection). */
let accessTokenInMemory: string | null = null;

/** In-memory user data (not persisted to localStorage for XSS protection). */
let userInMemory: AuthUser | null = null;

/** Get the access token from memory only. */
export function getAccessToken(): string | null {
  return accessTokenInMemory;
}

/** Set the access token in memory only. */
export function setAccessToken(token: string | null): void {
  accessTokenInMemory = token;
}

/** Get the stored user from memory only. */
export function getStoredUser(): AuthUser | null {
  return userInMemory;
}

/** Store the user in memory only. */
export function storeUser(user: AuthUser): void {
  userInMemory = user;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Decode a JWT payload without verifying the signature (client-side only). */
function decodeJwtPayload(token: string): { exp?: number; sub?: string; institute_id?: string; role?: string } | null {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window.atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/** Returns true if the access token exists and is not expired (with 30s safety margin). */
export function isAccessTokenValid(): boolean {
  const token = getAccessToken();
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 - Date.now() > 30_000;
}

/** Get the expiry timestamp (seconds) from the access token JWT payload. */
export function getTokenExpiry(token: string): number | null {
  const payload = decodeJwtPayload(token);
  return payload?.exp ?? null;
}

export function storeSession(result: LoginResult): void {
  // Access token in memory only (XSS protection); refresh token is in httpOnly cookie
  setAccessToken(result.tokens.accessToken);
  storeUser(result.user);
}

export function clearStoredSession(): void {
  setAccessToken(null);
  userInMemory = null;
}

function dispatchSessionExpired(): void {
  window.dispatchEvent(new Event('pdo:session-expired'));
}

function dispatchSessionRefreshed(user: AuthUser): void {
  window.dispatchEvent(new CustomEvent<AuthUser>('pdo:session-refreshed', { detail: user }));
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
  signal?: AbortSignal;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function toApiError(response: Response, payload: unknown): ApiError {
  const envelope = isRecord(payload) ? payload.error : null;
  const errorRecord = isRecord(envelope) ? envelope : null;

  const code =
    errorRecord && typeof errorRecord.code === 'string' ? errorRecord.code : 'REQUEST_FAILED';
  const message =
    errorRecord && typeof errorRecord.message === 'string'
      ? errorRecord.message
      : `The API responded with HTTP ${response.status}.`;

  return new ApiError(response.status, code, message, errorRecord?.details);
}

function extractData<T>(payload: unknown): T {
  if (!isRecord(payload) || payload.success !== true || !('data' in payload)) {
    throw new ApiError(502, 'INVALID_RESPONSE', 'The API returned an unexpected response.');
  }

  return payload.data as T;
}

let refreshInFlight: Promise<boolean> | null = null;

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        // Include credentials to send the httpOnly refresh token cookie
        credentials: 'include',
      });

      if (response.status === 401 || response.status === 403) {
        clearStoredSession();
        dispatchSessionExpired();
        return false;
      }

      if (!response.ok) {
        return false;
      }

      const payload = await readJson(response);
      const result = extractData<LoginResult>(payload);
      storeSession(result);
      dispatchSessionRefreshed(result.user);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, retryOnUnauthorized = true, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };

  if (auth) {
    const accessToken = getAccessToken();

    // Pre-flight: if we have no valid token, try to refresh silently before making the request.
    // This prevents the browser from logging 401s on requests we know will fail.
    if (accessToken && !isAccessTokenValid()) {
      await refreshAccessToken();
    }

    const refreshedToken = getAccessToken();
    if (refreshedToken) {
      headers.Authorization = `Bearer ${refreshedToken}`;
    }
  }

  const init: RequestInit = { method, headers };

  if (signal) {
    init.signal = signal;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  // Include credentials for cookie-based auth (refresh token)
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, credentials: 'include' });

  if (response.status === 401 && auth && retryOnUnauthorized) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      return request<T>(path, { ...options, retryOnUnauthorized: false });
    }
  }

  const payload = await readJson(response);

  if (!response.ok) {
    throw toApiError(response, payload);
  }

  return extractData<T>(payload);
}

export const api = {
  health(signal?: AbortSignal): Promise<HealthSnapshot> {
    return request<HealthSnapshot>('/api/v1/health', { auth: false, signal });
  },

  async login(email: string, password: string): Promise<LoginResult> {
    return request<LoginResult>('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });
  },

  async me(): Promise<AuthUser> {
    const result = await request<{ user: AuthUser }>('/api/v1/auth/me');
    storeUser(result.user);
    return result.user;
  },

  /** Silently refreshes the access token using the httpOnly refresh cookie. */
  async refreshAccessToken(): Promise<void> {
    await refreshAccessToken();
  },

  async listBatches(): Promise<BatchListResult> {
    return request<BatchListResult>('/api/v1/batches');
  },

  async getBatchRoster(batchId: string): Promise<BatchRosterResult> {
    return request<BatchRosterResult>(
      `/api/v1/batches/${encodeURIComponent(batchId)}/students`,
    );
  },

  async submitAttendance(
    input: SubmitAttendanceInput,
  ): Promise<{ attendance: AttendanceSummary }> {
    return request<{ attendance: AttendanceSummary }>('/api/v1/attendance/submit', {
      method: 'POST',
      body: input,
    });
  },

  async createDemoLead(input: DemoLeadInput): Promise<DemoLeadResult> {
    return request<DemoLeadResult>('/api/v1/leads/demo', {
      method: 'POST',
      body: input,
      auth: false,
    });
  },

  async getEscalationTasks(): Promise<EscalationTasksResponse> {
    return request<EscalationTasksResponse>('/api/v1/escalation/tasks');
  },

  async resolveEscalationTask(input: ResolveEscalationInput): Promise<{ task: EscalationTask }> {
    return request<{ task: EscalationTask }>('/api/v1/escalation/tasks/resolve', {
      method: 'POST',
      body: input,
    });
  },

  // Phase 3: Admin Leads
  async listLeads(page = 1, pageSize = 20, status?: string): Promise<LeadListResult> {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set('status', status);
    return request<LeadListResult>(`/api/v1/admin/leads?${params.toString()}`);
  },

  async updateLeadStatus(leadId: string, input: UpdateLeadStatusInput): Promise<{ lead: AdminLead }> {
    return request<{ lead: AdminLead }>(`/api/v1/admin/leads/${encodeURIComponent(leadId)}`, {
      method: 'PATCH',
      body: input,
    });
  },

  // Phase 3: Admin Batches
  async listBatchesAdmin(): Promise<BatchListResultAdmin> {
    return request<BatchListResultAdmin>('/api/v1/admin/batches');
  },

  async createBatch(input: CreateBatchInput): Promise<{ batch: AdminBatch }> {
    return request<{ batch: AdminBatch }>('/api/v1/admin/batches', {
      method: 'POST',
      body: input,
    });
  },

  async updateBatch(batchId: string, input: UpdateBatchInput): Promise<{ batch: AdminBatch }> {
    return request<{ batch: AdminBatch }>(`/api/v1/admin/batches/${encodeURIComponent(batchId)}`, {
      method: 'PATCH',
      body: input,
    });
  },

  // Phase 3: Admin Students
  async listStudents(page = 1, pageSize = 20, batchId?: string): Promise<StudentListResult> {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (batchId) params.set('batchId', batchId);
    return request<StudentListResult>(`/api/v1/admin/students?${params.toString()}`);
  },

  async createStudent(input: CreateStudentInput): Promise<{ student: AdminStudent }> {
    return request<{ student: AdminStudent }>('/api/v1/admin/students', {
      method: 'POST',
      body: input,
    });
  },

  async updateStudent(studentId: string, input: UpdateStudentInput): Promise<{ student: AdminStudent }> {
    return request<{ student: AdminStudent }>(`/api/v1/admin/students/${encodeURIComponent(studentId)}`, {
      method: 'PATCH',
      body: input,
    });
  },

  async bulkImportStudents(input: { students: Array<{ fullName: string; rollNumber: string; parentName: string; parentWhatsapp: string; parentSecondaryPhone?: string | null; batchId: string | null; isActive?: boolean }> }): Promise<BulkImportResult> {
    return request<BulkImportResult>('/api/v1/admin/students/bulk', {
      method: 'POST',
      body: input,
    });
  },

  // Phase 3: Daily Attendance Report
  async getDailyAttendanceReport(date?: string): Promise<{ report: DailyAttendanceReport }> {
    const params = date ? `?date=${encodeURIComponent(date)}` : '';
    return request<{ report: DailyAttendanceReport }>(`/api/v1/admin/reports/daily${params}`);
  },

  // Phase 4: Auth lifecycle
  async logout(): Promise<{ message: string }> {
    return request<{ message: string }>('/api/v1/auth/logout', {
      method: 'POST',
      // Body can be empty since we read from cookie
    });
  },

  async verifyEmail(token: string): Promise<{ message: string; alreadyVerified: boolean; email?: string }> {
    return request<{ message: string; alreadyVerified: boolean; email?: string }>('/api/v1/auth/verify-email', {
      method: 'POST',
      body: { token },
      auth: false,
    });
  },

  async resendVerification(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('/api/v1/auth/resend-verification', {
      method: 'POST',
      body: { email },
      auth: false,
    });
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    return request<{ message: string }>('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: { email },
      auth: false,
    });
  },

  async resetPassword(token: string, password: string): Promise<{ message: string }> {
    return request<{ message: string }>('/api/v1/auth/reset-password', {
      method: 'POST',
      body: { token, password, confirmPassword: password },
      auth: false,
    });
  },

  async registerInstitute(data: {
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
    confirmPassword: string;
  }): Promise<{ instituteId: string; userId: string; message: string }> {
    return request<{ instituteId: string; userId: string; message: string }>(
      '/api/v1/auth/register-institute',
      {
        method: 'POST',
        body: data,
        auth: false,
      },
    );
  },

  // Phase 4: Profile management
  async getProfile(): Promise<{ user: AuthUser & { emailVerified: boolean; avatarInitials: string | null } }> {
    return request<{ user: AuthUser & { emailVerified: boolean; avatarInitials: string | null } }>(
      '/api/v1/profile',
    );
  },

  async updateProfile(data: { fullName?: string; phone?: string; avatarInitials?: string }): Promise<{
    user: AuthUser & { emailVerified: boolean; avatarInitials: string | null };
  }> {
    return request<{
      user: AuthUser & { emailVerified: boolean; avatarInitials: string | null };
    }>('/api/v1/profile', {
      method: 'PATCH',
      body: data,
    });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    return request<{ message: string }>('/api/v1/profile/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword, confirmPassword: newPassword },
    });
  },

  async deleteAccount(password: string, confirmation: string): Promise<{
    message: string;
    wasSoleAdmin: boolean;
    instituteDeactivated: boolean;
  }> {
    return request<{
      message: string;
      wasSoleAdmin: boolean;
      instituteDeactivated: boolean;
    }>('/api/v1/profile/account', {
      method: 'DELETE',
      body: { password, confirmation },
    });
  },
};
