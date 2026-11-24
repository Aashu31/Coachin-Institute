import type { AttendanceMark, AttendanceRecordInput } from './types';

const DRAFT_PREFIX = 'pdo.attendance.draft.v1.';
const PENDING_KEY = 'pdo.attendance.pending.v1';
const MAX_PENDING_SUBMISSIONS = 20;

export interface AttendanceDraft {
  version: 1;
  batchId: string;
  attendanceDate: string;
  marks: Record<string, AttendanceMark>;
  updatedAt: string;
}

export interface PendingSubmission {
  id: string;
  batchId: string;
  attendanceDate: string;
  records: AttendanceRecordInput[];
  queuedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAttendanceMark(value: unknown): value is AttendanceMark {
  return value === 'PRESENT' || value === 'ABSENT';
}

function draftKey(batchId: string, attendanceDate: string): string {
  return `${DRAFT_PREFIX}${batchId}.${attendanceDate}`;
}

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode / quota). The in-memory sheet still works.
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing recoverable.
  }
}

export function loadDraft(batchId: string, attendanceDate: string): AttendanceDraft | null {
  const raw = safeGet(draftKey(batchId, attendanceDate));

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isRecord(parsed) || parsed.version !== 1) {
      return null;
    }

    if (parsed.batchId !== batchId || parsed.attendanceDate !== attendanceDate) {
      return null;
    }

    const marks: Record<string, AttendanceMark> = {};

    if (isRecord(parsed.marks)) {
      for (const [studentId, value] of Object.entries(parsed.marks)) {
        if (isAttendanceMark(value)) {
          marks[studentId] = value;
        }
      }
    }

    return {
      version: 1,
      batchId,
      attendanceDate,
      marks,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: AttendanceDraft): void {
  safeSet(draftKey(draft.batchId, draft.attendanceDate), JSON.stringify(draft));
}

export function clearDraft(batchId: string, attendanceDate: string): void {
  safeRemove(draftKey(batchId, attendanceDate));
}

function isRecordArray(value: unknown): value is AttendanceRecordInput[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) && typeof item.studentId === 'string' && isAttendanceMark(item.status),
    )
  );
}

export function loadPendingSubmissions(): PendingSubmission[] {
  const raw = safeGet(PENDING_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item): PendingSubmission[] => {
      if (
        !isRecord(item) ||
        typeof item.id !== 'string' ||
        typeof item.batchId !== 'string' ||
        typeof item.attendanceDate !== 'string' ||
        typeof item.queuedAt !== 'string' ||
        !isRecordArray(item.records)
      ) {
        return [];
      }

      return [
        {
          id: item.id,
          batchId: item.batchId,
          attendanceDate: item.attendanceDate,
          records: item.records,
          queuedAt: item.queuedAt,
        },
      ];
    });
  } catch {
    return [];
  }
}

function persistPending(submissions: PendingSubmission[]): void {
  safeSet(PENDING_KEY, JSON.stringify(submissions.slice(0, MAX_PENDING_SUBMISSIONS)));
}

export function enqueuePendingSubmission(
  batchId: string,
  attendanceDate: string,
  records: AttendanceRecordInput[],
): PendingSubmission {
  const submission: PendingSubmission = {
    id: `${batchId}.${attendanceDate}`,
    batchId,
    attendanceDate,
    records,
    queuedAt: new Date().toISOString(),
  };

  const existing = loadPendingSubmissions().filter((item) => item.id !== submission.id);
  persistPending([submission, ...existing]);

  return submission;
}

export function removePendingSubmission(id: string): void {
  persistPending(loadPendingSubmissions().filter((item) => item.id !== id));
}
