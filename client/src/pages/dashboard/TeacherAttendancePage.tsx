import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ApiError, api } from '../../lib/api';
import {
  clearDraft,
  enqueuePendingSubmission,
  loadDraft,
  loadPendingSubmissions,
  removePendingSubmission,
  saveDraft,
  type AttendanceDraft,
} from '../../lib/attendanceDraft';
import { useAuth } from '../../lib/auth';
import {
  formatClockTime,
  formatDateLabel,
  formatTimeOfDay,
  todayInTenantTimezone,
} from '../../lib/format';
import { initials } from '../../lib/roles';
import type {
  AttendanceMark,
  AttendanceRecordInput,
  AttendanceSummary,
  BatchListResult,
  BatchRosterResult,
  BatchSummary,
  SubmitAttendanceInput,
} from '../../lib/types';

type LoadState = 'loading' | 'ready' | 'error';

function WifiIcon({ offline = false }: { offline?: boolean }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" className="h-3.5 w-3.5">
      {offline ? (
        <>
          <path strokeLinecap="round" d="M3 3l18 18M8.5 8.5a10 10 0 0111 2M5 5a15 15 0 0114 0M12 18h.01" />
        </>
      ) : (
        <>
          <path strokeLinecap="round" d="M2.5 8.5a16 16 0 0119 0M5.5 12a11 11 0 0113 0M8.5 15.5a6 6 0 017 0" />
          <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CrossIcon({ className = 'h-4 w-4' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={className}>
      <path
        fillRule="evenodd"
        d="M5.3 5.3a1 1 0 011.4 0L10 8.6l3.3-3.3a1 1 0 111.4 1.4L11.4 10l3.3 3.3a1 1 0 01-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 01-1.4-1.4L8.6 10 5.3 6.7a1 1 0 010-1.4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function LockIcon({ className = 'h-4 w-4' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" className={className}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path strokeLinecap="round" d="M8 10V7a4 4 0 118 0v3" />
    </svg>
  );
}

function CloudIcon({ className = 'h-4 w-4' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 18a4 4 0 01-.4-7.98A6 6 0 0118 9.5a3.5 3.5 0 01.5 6.96" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v6m0 0l-2-2m2 2l2-2" />
    </svg>
  );
}

function Spinner(): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

interface ConfirmDialogProps {
  open: boolean;
  online: boolean;
  submitting: boolean;
  batchName: string;
  presentCount: number;
  absentCount: number;
  absentNames: string[];
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  open,
  online,
  submitting,
  batchName,
  presentCount,
  absentCount,
  absentNames,
  onCancel,
  onConfirm,
}: ConfirmDialogProps): JSX.Element | null {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    confirmRef.current?.focus();

    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !submitting) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, submitting, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm"
        onClick={() => {
          if (!submitting) {
            onCancel();
          }
        }}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attendance-confirm-title"
        aria-describedby="attendance-confirm-description"
        className="animate-sheet-in relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <LockIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 id="attendance-confirm-title" className="font-display text-lg font-bold text-slate-900">
              Lock this attendance sheet?
            </h2>
            <p id="attendance-confirm-description" className="mt-1 text-xs leading-relaxed text-slate-500">
              {batchName}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-green-50 px-3 py-2.5 text-center ring-1 ring-inset ring-green-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-green-700">Present</p>
            <p className="mt-0.5 font-mono text-xl font-bold text-green-800">{presentCount}</p>
          </div>
          <div className="rounded-xl bg-red-50 px-3 py-2.5 text-center ring-1 ring-inset ring-red-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Absent</p>
            <p className="mt-0.5 font-mono text-xl font-bold text-red-800">{absentCount}</p>
          </div>
        </div>

        {absentCount > 0 ? (
          <div className="mt-3 rounded-xl border border-red-100 bg-red-50/60 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">
              Parents to verify at T+10
            </p>
            <ul className="mt-1.5 space-y-1 text-xs text-red-900">
              {absentNames.slice(0, 5).map((name) => (
                <li key={name} className="flex items-center gap-1.5">
                  <CrossIcon className="h-3 w-3 flex-none" />
                  <span className="truncate">{name}</span>
                </li>
              ))}
              {absentNames.length > 5 ? (
                <li className="pl-[18px] text-[11px] font-semibold text-red-700">
                  + {absentNames.length - 5} more
                </li>
              ) : null}
            </ul>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-green-100 bg-green-50/60 p-3 text-xs text-green-900">
            All students are marked present. No parent verification will be scheduled.
          </div>
        )}

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[11px] leading-relaxed text-amber-900">
            {online
              ? 'Once submitted, this sheet is locked for teachers. In Phase 2, absent parents receive a WhatsApp check at T+10.'
              : 'You are offline. This sheet will be stored on this phone and synced automatically when the connection returns.'}
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="btn-primary flex-1"
          >
            {submitting ? (
              <>
                <Spinner />
                {online ? 'Locking…' : 'Saving…'}
              </>
            ) : online ? (
              'Confirm & lock attendance'
            ) : (
              'Save offline & queue sync'
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TeacherAttendancePage(): JSX.Element {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [batchesState, setBatchesState] = useState<LoadState>('loading');
  const [batchesData, setBatchesData] = useState<BatchListResult | null>(null);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [batchesRefreshKey, setBatchesRefreshKey] = useState(0);

  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [rosterState, setRosterState] = useState<LoadState>('loading');
  const [roster, setRoster] = useState<BatchRosterResult | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterRefreshKey, setRosterRefreshKey] = useState(0);

  const [marks, setMarks] = useState<Record<string, AttendanceMark>>({});
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<AttendanceSummary | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);

  const [online, setOnline] = useState<boolean>(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const requestedBatchId = searchParams.get('batchId');
  const requestedBatchIdRef = useRef<string | null>(searchParams.get('batchId'));

  // ---- Load the timetable -------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setBatchesState('loading');
    setBatchesError(null);

    api
      .listBatches()
      .then((result) => {
        if (cancelled) {
          return;
        }

        setBatchesData(result);
        setBatchesState('ready');

        setSelectedBatchId((current) => {
          if (current && result.batches.some((batch) => batch.batchId === current)) {
            return current;
          }

          const requested = requestedBatchIdRef.current
            ? result.batches.find((batch) => batch.batchId === requestedBatchIdRef.current)
            : undefined;
          const today = result.batches.find((batch) => batch.isScheduledToday);
          const first = result.batches[0];

          return (requested ?? today ?? first)?.batchId ?? '';
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setBatchesError(
          error instanceof ApiError
            ? error.message
            : 'The batch list could not be loaded. Check the API connection.',
        );
        setBatchesState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [batchesRefreshKey]);

  // Deep links from the overview page (`?batchId=…`) select that batch without
  // refetching the timetable.
  useEffect(() => {
    if (!requestedBatchId || !batchesData) {
      return;
    }

    if (batchesData.batches.some((batch) => batch.batchId === requestedBatchId)) {
      setSelectedBatchId((current) => (current === requestedBatchId ? current : requestedBatchId));
    }
  }, [requestedBatchId, batchesData]);

  // ---- Load the roster for the selected batch -----------------------------
  const loadRoster = useCallback(async (batchId: string): Promise<void> => {
    setRosterState('loading');
    setRosterError(null);

    try {
      const result = await api.getBatchRoster(batchId);
      const nextMarks: Record<string, AttendanceMark> = {};

      const draft = result.existingAttendance
        ? null
        : loadDraft(batchId, result.attendanceDate);

      for (const student of result.students) {
        if (student.status) {
          nextMarks[student.studentId] = student.status;
          continue;
        }

        const draftMark = draft?.marks[student.studentId];
        nextMarks[student.studentId] = draftMark ?? 'PRESENT';
      }

      if (result.existingAttendance) {
        clearDraft(batchId, result.attendanceDate);
        setDraftRestored(false);
        setDraftSavedAt(null);
      } else {
        setDraftRestored(Boolean(draft && Object.keys(draft.marks).length > 0));
        setDraftSavedAt(draft?.updatedAt ?? null);
      }

      setRoster(result);
      setMarks(nextMarks);
      setRosterState('ready');
    } catch (error) {
      setRosterError(
        error instanceof ApiError
          ? error.message
          : 'The student roster could not be loaded. Check the API connection.',
      );
      setRosterState('error');
    }
  }, []);

  useEffect(() => {
    if (!selectedBatchId) {
      return;
    }

    void loadRoster(selectedBatchId);
  }, [selectedBatchId, loadRoster, rosterRefreshKey]);

  // ---- Persist an offline draft on every tap ------------------------------
  useEffect(() => {
    if (!roster || rosterState !== 'ready' || roster.existingAttendance) {
      return;
    }

    if (Object.keys(marks).length === 0) {
      return;
    }

    const draft: AttendanceDraft = {
      version: 1,
      batchId: roster.batch.batchId,
      attendanceDate: roster.attendanceDate,
      marks,
      updatedAt: new Date().toISOString(),
    };

    saveDraft(draft);
    setDraftSavedAt(draft.updatedAt);
  }, [marks, roster, rosterState]);

  // ---- Offline queue sync -------------------------------------------------
  const syncPending = useCallback(async (): Promise<void> => {
    if (!navigator.onLine) {
      return;
    }

    const pending = loadPendingSubmissions();

    if (pending.length === 0) {
      return;
    }

    setSyncing(true);
    let synced = 0;

    for (const item of pending) {
      try {
        await api.submitAttendance({
          batchId: item.batchId,
          attendanceDate: item.attendanceDate,
          records: item.records,
        });

        removePendingSubmission(item.id);
        synced += 1;

        if (item.batchId === selectedBatchId) {
          setQueuedOffline(false);
          setRosterRefreshKey((current) => current + 1);
        }
      } catch (error) {
        if (error instanceof ApiError && (error.status === 409 || error.status === 422)) {
          removePendingSubmission(item.id);
          setSyncMessage(
            'An offline sheet was rejected because it was already locked or the roster changed. Please review it again.',
          );
          continue;
        }

        setSyncMessage('Still unable to sync. The sheet stays saved on this phone.');
        break;
      }
    }

    setSyncing(false);

    if (synced > 0) {
      setSyncMessage(
        `${synced} offline attendance sheet${synced === 1 ? '' : 's'} synced successfully.`,
      );
      setBatchesRefreshKey((current) => current + 1);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    if (navigator.onLine) {
      void syncPending();
    }

    const handleOnline = (): void => {
      setOnline(true);
      void syncPending();
    };
    const handleOffline = (): void => {
      setOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncPending]);

  // ---- Derived sheet state ------------------------------------------------
  const activeBatch: BatchSummary | null = useMemo(() => {
    if (roster) {
      return roster.batch;
    }

    return batchesData?.batches.find((batch) => batch.batchId === selectedBatchId) ?? null;
  }, [roster, batchesData, selectedBatchId]);

  const records = useMemo<AttendanceRecordInput[]>(() => {
    if (!roster) {
      return [];
    }

    return roster.students.map((student) => ({
      studentId: student.studentId,
      status: marks[student.studentId] ?? 'PRESENT',
    }));
  }, [roster, marks]);

  const presentCount = records.filter((record) => record.status === 'PRESENT').length;
  const absentCount = records.length - presentCount;
  const absentStudents = roster
    ? roster.students.filter((student) => (marks[student.studentId] ?? 'PRESENT') === 'ABSENT')
    : [];

  const locked = Boolean(roster?.existingAttendance || success || queuedOffline);
  const attendanceDate = roster?.attendanceDate ?? batchesData?.today ?? todayInTenantTimezone();
  const scheduledBatches = batchesData?.batches.filter((batch) => batch.isScheduledToday) ?? [];
  const otherBatches = batchesData?.batches.filter((batch) => !batch.isScheduledToday) ?? [];

  function selectBatch(nextBatchId: string): void {
    setSelectedBatchId(nextBatchId);
    setSuccess(null);
    setSubmitError(null);
    setQueuedOffline(false);
    setDraftRestored(false);
    setSearchParams({ batchId: nextBatchId }, { replace: true });
  }

  function toggleStudent(studentId: string): void {
    if (locked) {
      return;
    }

    navigator.vibrate?.(8);

    setMarks((current) => {
      const currentMark = current[studentId] ?? 'PRESENT';
      return {
        ...current,
        [studentId]: currentMark === 'PRESENT' ? 'ABSENT' : 'PRESENT',
      };
    });
  }

  function markAllPresent(): void {
    if (!roster || locked) {
      return;
    }

    const next: Record<string, AttendanceMark> = {};
    for (const student of roster.students) {
      next[student.studentId] = 'PRESENT';
    }
    setMarks(next);
  }

  async function handleConfirm(): Promise<void> {
    if (!roster) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const payload: SubmitAttendanceInput = {
      batchId: roster.batch.batchId,
      attendanceDate: roster.attendanceDate,
      records,
    };

    if (!navigator.onLine) {
      enqueuePendingSubmission(roster.batch.batchId, roster.attendanceDate, records);
      clearDraft(roster.batch.batchId, roster.attendanceDate);
      setQueuedOffline(true);
      setConfirmOpen(false);
      setSubmitting(false);
      return;
    }

    try {
      const result = await api.submitAttendance(payload);
      clearDraft(roster.batch.batchId, roster.attendanceDate);
      setSuccess(result.attendance);
      setConfirmOpen(false);
      setDraftSavedAt(null);
      setRosterRefreshKey((current) => current + 1);
      setBatchesRefreshKey((current) => current + 1);
    } catch (error) {
      setConfirmOpen(false);

      if (error instanceof ApiError) {
        setSubmitError(error.message);

        if (error.code === 'ATTENDANCE_LOCKED' || error.status === 409) {
          setRosterRefreshKey((current) => current + 1);
          setBatchesRefreshKey((current) => current + 1);
        }
      } else {
        setSubmitError('The attendance sheet could not be saved. Check the connection and retry.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function queueCurrentSheet(): void {
    if (!roster) {
      return;
    }

    enqueuePendingSubmission(roster.batch.batchId, roster.attendanceDate, records);
    clearDraft(roster.batch.batchId, roster.attendanceDate);
    setQueuedOffline(true);
    setSubmitError(null);
    setConfirmOpen(false);
    setBatchesRefreshKey((current) => current + 1);
  }

  function discardQueuedSheet(): void {
    if (!roster) {
      return;
    }

    removePendingSubmission(`${roster.batch.batchId}.${roster.attendanceDate}`);
    setQueuedOffline(false);
  }

  return (
    <div className="mx-auto w-full max-w-2xl animate-fade-in pb-40 lg:pb-0">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            Teacher attendance
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            15-second roll call
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {formatDateLabel(attendanceDate)} · every student starts present
            {user ? ` · ${user.fullName}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${
              online
                ? 'bg-green-50 text-green-700 ring-green-200'
                : 'bg-red-50 text-red-700 ring-red-200'
            }`}
          >
            <WifiIcon offline={!online} />
            {online ? 'Online' : 'Offline'}
          </span>
          {draftSavedAt ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800 ring-1 ring-inset ring-amber-200">
              <CloudIcon className="h-3.5 w-3.5" />
              Draft {formatClockTime(draftSavedAt)}
            </span>
          ) : null}
        </div>
      </div>

      {/* Batch selector */}
      <section className="card mt-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="batch-selector" className="field-label">
              Selected batch
            </label>
            <select
              id="batch-selector"
              value={selectedBatchId}
              onChange={(event) => selectBatch(event.target.value)}
              disabled={batchesState !== 'ready' || (batchesData?.batches.length ?? 0) === 0}
              className="input-field font-semibold"
            >
              {batchesData && batchesData.batches.length === 0 ? (
                <option value="">No batches assigned</option>
              ) : null}

              {scheduledBatches.length > 0 ? (
                <optgroup label="Today’s schedule">
                  {scheduledBatches.map((batch) => (
                    <option key={batch.batchId} value={batch.batchId}>
                      {formatTimeOfDay(batch.scheduledStartTime)} · {batch.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}

              {otherBatches.length > 0 ? (
                <optgroup label={scheduledBatches.length > 0 ? 'Other active batches' : 'Active batches'}>
                  {otherBatches.map((batch) => (
                    <option key={batch.batchId} value={batch.batchId}>
                      {formatTimeOfDay(batch.scheduledStartTime)} · {batch.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </div>

          <span
            className={`status-pill ring-1 ring-inset ${
              activeBatch?.isScheduledToday
                ? 'bg-blue-50 text-blue-700 ring-blue-200'
                : 'bg-slate-100 text-slate-600 ring-slate-200'
            }`}
          >
            {activeBatch?.isScheduledToday ? 'Scheduled today' : 'Not scheduled today'}
          </span>
        </div>

        {activeBatch ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">{activeBatch.name}</span>
            <span>
              {formatTimeOfDay(activeBatch.scheduledStartTime)} –{' '}
              {formatTimeOfDay(activeBatch.scheduledEndTime)}
            </span>
            <span>{activeBatch.roomNumber ?? 'Room TBD'}</span>
            <span>{activeBatch.teacherName ?? 'Faculty not assigned'}</span>
            <span className="font-mono text-[10px] text-slate-500">
              {activeBatch.studentCount} students
            </span>
          </div>
        ) : null}

        {batchesState === 'error' ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
            <p className="text-xs font-medium text-red-700">{batchesError}</p>
            <button
              type="button"
              onClick={() => setBatchesRefreshKey((current) => current + 1)}
              className="mt-2 text-xs font-semibold text-red-800 underline"
            >
              Retry
            </button>
          </div>
        ) : null}
      </section>

      {/* Notices */}
      <div className="mt-4 space-y-3" aria-live="polite">
        {draftRestored ? (
          <div className="animate-toast-in flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
            <p className="text-xs leading-relaxed text-amber-900">
              <span className="font-semibold">Draft restored from this phone.</span> Your last
              unsaved marks were loaded.
            </p>
            <button
              type="button"
              onClick={() => setDraftRestored(false)}
              className="text-[10px] font-bold uppercase tracking-wider text-amber-800"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {success ? (
          <div className="animate-toast-in rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-green-600 text-white">
                <CheckIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-green-900">
                  {success.idempotentReplay ? 'Attendance was already saved' : 'Attendance locked & synced'}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-green-800">
                  {success.presentCount} present · {success.absentCount} absent · submitted{' '}
                  {formatClockTime(success.submittedAt)}
                </p>
                {success.absentCount > 0 ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-green-700">
                    Parent WhatsApp verification is scheduled for{' '}
                    <span className="font-mono font-semibold">
                      {formatClockTime(success.verificationScheduledAt)}
                    </span>{' '}
                    (Phase 2 engine).
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {queuedOffline ? (
          <div className="animate-toast-in rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-amber-500 text-white">
                  <CloudIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-amber-900">Saved on this phone</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                    This sheet will sync automatically when the connection returns. Keep this tab
                    open if you can.
                  </p>
                </div>
              </div>
              <div className="flex flex-none flex-col items-end gap-1.5">
                <button
                  type="button"
                  onClick={() => void syncPending()}
                  disabled={!online || syncing}
                  className="text-[10px] font-bold uppercase tracking-wider text-amber-900 underline disabled:opacity-50"
                >
                  {syncing ? 'Syncing…' : 'Sync now'}
                </button>
                <button
                  type="button"
                  onClick={discardQueuedSheet}
                  className="text-[10px] font-semibold text-amber-700 underline"
                >
                  Edit sheet
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {syncMessage ? (
          <div className="animate-toast-in flex items-start justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5">
            <p className="text-xs leading-relaxed text-blue-900">{syncMessage}</p>
            <button
              type="button"
              onClick={() => setSyncMessage(null)}
              className="text-[10px] font-bold uppercase tracking-wider text-blue-800"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {roster?.existingAttendance ? (
          <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-slate-900 text-white">
                <LockIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Attendance locked for {formatDateLabel(roster.attendanceDate)}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {roster.existingAttendance.presentCount} present ·{' '}
                  {roster.existingAttendance.absentCount} absent · submitted{' '}
                  {formatClockTime(roster.existingAttendance.submittedAt)}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Teachers cannot edit a locked sheet. An institute admin or front-desk operator can
                  make an audited correction in a later phase.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {submitError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3.5">
            <p className="text-xs font-medium leading-relaxed text-red-800">{submitError}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setSubmitError(null);
                  setConfirmOpen(true);
                }}
                className="text-[10px] font-bold uppercase tracking-wider text-red-800 underline"
              >
                Retry submission
              </button>
              <button
                type="button"
                onClick={queueCurrentSheet}
                className="text-[10px] font-bold uppercase tracking-wider text-red-700 underline"
              >
                Save for offline sync
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Roster */}
      {rosterState === 'error' ? (
        <div className="card mt-4 border-red-200 bg-red-50 p-5">
          <p className="text-sm font-semibold text-red-800">Roster unavailable</p>
          <p className="mt-1 text-xs leading-relaxed text-red-700">{rosterError}</p>
          <button
            type="button"
            onClick={() => setRosterRefreshKey((current) => current + 1)}
            className="btn-secondary mt-3 !min-h-9 !py-1.5 text-xs"
          >
            Retry roster
          </button>
        </div>
      ) : null}

      {batchesState === 'ready' && (batchesData?.batches.length ?? 0) === 0 ? (
        <div className="card mt-4 p-8 text-center">
          <p className="text-sm font-semibold text-slate-900">No batches assigned yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
            Ask the institute admin to assign you to a batch. Attendance for a batch becomes
            available as soon as the assignment is saved.
          </p>
        </div>
      ) : null}

      {selectedBatchId && rosterState !== 'error' && (batchesData?.batches.length ?? 0) > 0 ? (
        <section className="mt-5">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">
                Students
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Tap a row to toggle present / absent. Minimum 48px touch targets.
              </p>
            </div>
            {!locked && rosterState === 'ready' && absentCount > 0 ? (
              <button
                type="button"
                onClick={markAllPresent}
                className="text-[10px] font-bold uppercase tracking-wider text-blue-700 underline"
              >
                Reset all present
              </button>
            ) : null}
          </div>

          {rosterState === 'loading' ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : roster ? (
            <ul className="space-y-2">
              {roster.students.map((student) => {
                const mark = marks[student.studentId] ?? 'PRESENT';
                const isPresent = mark === 'PRESENT';

                return (
                  <li key={student.studentId}>
                    <button
                      type="button"
                      onClick={() => toggleStudent(student.studentId)}
                      disabled={locked}
                      aria-pressed={!isPresent}
                      aria-label={`${student.fullName}, roll ${student.rollNumber}, marked ${
                        isPresent ? 'present' : 'absent'
                      }. Tap to mark ${isPresent ? 'absent' : 'present'}.`}
                      className={`flex min-h-[58px] w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left shadow-sm transition duration-150 sm:min-h-touch ${
                        isPresent
                          ? 'border-green-200 bg-green-50/70 hover:border-green-300'
                          : 'border-red-200 bg-red-50 hover:border-red-300'
                      } ${locked ? 'cursor-default opacity-90' : 'active:scale-[0.995]'}`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-9 w-9 flex-none items-center justify-center rounded-full font-display text-[10px] font-bold ${
                            isPresent
                              ? 'bg-green-600 text-white'
                              : 'bg-red-600 text-white'
                          }`}
                          aria-hidden="true"
                        >
                          {initials(student.fullName)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {student.fullName}
                          </span>
                          <span className="mt-0.5 block font-mono text-[10px] text-slate-500">
                            {student.rollNumber}
                          </span>
                        </span>
                      </span>

                      <span
                        className={`status-pill flex-none ring-1 ring-inset ${
                          isPresent
                            ? 'bg-green-100 text-green-800 ring-green-200'
                            : 'bg-red-100 text-red-800 ring-red-200'
                        }`}
                      >
                        {isPresent ? <CheckIcon className="h-3.5 w-3.5" /> : <CrossIcon className="h-3.5 w-3.5" />}
                        {isPresent ? 'PRESENT' : 'ABSENT'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {roster && roster.students.length === 0 ? (
            <div className="card p-6 text-center">
              <p className="text-sm font-semibold text-slate-900">No active students</p>
              <p className="mt-1 text-xs text-slate-500">
                Add students to this batch from the admin workspace before taking attendance.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Sticky summary / submit bar */}
      {roster && roster.students.length > 0 ? (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur lg:static lg:mt-6 lg:rounded-2xl lg:border lg:bg-white lg:p-0 lg:pb-0 lg:shadow-sm">
          <div className="mx-auto flex max-w-2xl items-center gap-3 lg:p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                <span className="font-semibold text-green-700">
                  Present: <span className="font-mono text-sm font-bold">{presentCount}</span>
                </span>
                <span className="font-semibold text-red-700">
                  Absent: <span className="font-mono text-sm font-bold">{absentCount}</span>
                </span>
                <span className="text-[10px] text-slate-400">/ {records.length} students</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-red-100">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-200"
                  style={{
                    width: records.length === 0 ? '0%' : `${(presentCount / records.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            {locked ? (
              <span className="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-600">
                <LockIcon className="h-4 w-4" />
                {queuedOffline ? 'Queued' : 'Locked'}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSubmitError(null);
                  setConfirmOpen(true);
                }}
                className="btn-primary flex-none !px-4 text-xs sm:text-sm"
              >
                {online ? 'Submit attendance' : 'Save offline'}
              </button>
            )}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        online={online}
        submitting={submitting}
        batchName={activeBatch?.name ?? 'Attendance sheet'}
        presentCount={presentCount}
        absentCount={absentCount}
        absentNames={absentStudents.map((student) => student.fullName)}
        onCancel={() => {
          if (!submitting) {
            setConfirmOpen(false);
          }
        }}
        onConfirm={() => {
          void handleConfirm();
        }}
      />
    </div>
  );
}
