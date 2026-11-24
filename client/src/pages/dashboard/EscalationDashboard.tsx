import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { formatClockTime, formatDateLabel, todayInTenantTimezone } from '../../lib/format';
import type { EscalationCallOutcome, EscalationTask } from '../../lib/types';
import { SkeletonCard, ButtonSpinner, EmptyEscalation } from '../../components/ui';

type LoadState = 'loading' | 'ready' | 'error';

function PhoneIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function AlertCircleIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M12 8a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  );
}

function ClockIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
    </svg>
  );
}

function CheckCircleIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  );
}

function XCircleIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9l-6 6M9 9l6 6" />
    </svg>
  );
}

interface KpiCardProps {
  label: string;
  value: string | number;
  hint: string;
  icon: JSX.Element;
  tone: 'blue' | 'green' | 'amber' | 'red' | 'slate';
}

const KPI_TONES: Record<KpiCardProps['tone'], string> = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  green: 'bg-green-50 text-green-700 ring-green-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
};

function KpiCard({ label, value, hint, icon, tone }: KpiCardProps): JSX.Element {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
          <p className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{value}</p>
        </div>
        <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ring-1 ring-inset ${KPI_TONES[tone]}`}>{icon}</span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{hint}</p>
    </div>
  );
}

interface RedAlertCardProps {
  task: EscalationTask;
  onResolve: (taskId: string) => void;
}

function RedAlertCard({ task, onResolve }: RedAlertCardProps): JSX.Element {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOutcome, setSelectedOutcome] = useState<EscalationCallOutcome | null>(null);
  const [staffNotes, setStaffNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const elapsedMinutes = task.elapsedMinutes;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const elapsedMins = elapsedMinutes % 60;

  function handleResolveClick(): void {
    setSelectedOutcome(null);
    setStaffNotes('');
    setResolveError(null);
    setIsModalOpen(true);
  }

  async function confirmResolve(): Promise<void> {
    if (!selectedOutcome || !staffNotes.trim()) {
      setResolveError('Please select an outcome and enter notes.');
      return;
    }

    setResolving(true);
    setResolveError(null);

    try {
      await api.resolveEscalationTask({
        taskId: task.taskId,
        callOutcome: selectedOutcome,
        staffNotes: staffNotes.trim(),
      });
      setIsModalOpen(false);
      onResolve(task.taskId);
    } catch (error) {
      setResolveError(error instanceof Error ? error.message : 'Failed to resolve escalation task.');
    } finally {
      setResolving(false);
    }
  }

  return (
    <>
      <div className="animate-alert-pulse relative border-l-8 border-red-600 bg-red-50 p-5 rounded-xl shadow-red border border-red-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-3 h-3 rounded-full bg-red-600 animate-ping" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-wider text-red-700">RED ALERT — Call Required</span>
            <span className="ml-auto font-mono text-xs text-red-800 bg-red-100 px-2 py-0.5 rounded-full">
              {elapsedHours > 0 ? `${elapsedHours}h ${elapsedMins}m` : `${elapsedMins}m`} elapsed
            </span>
          </div>
          <h4 className="text-lg font-bold text-slate-900">{task.studentName} (Roll: {task.studentRollNumber})</h4>
          <p className="mt-1 text-sm text-slate-600">
            Batch: <span className="font-medium">{task.batchName}</span>
            {' | '}
            <PhoneIcon className="inline h-4 w-4" />
            <a href={`tel:${task.parentWhatsapp}`} className="font-medium text-red-700 hover:underline ml-1">{task.parentWhatsapp ? task.parentWhatsapp.replace('+91', '0') : '<span class="text-slate-400">—</span>'}</a>
          </p>
          <p className="mt-1 text-xs text-slate-500">Triggered at {formatClockTime(task.triggeredAt)} • Priority: {task.priority}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:ml-4">
          <button
            ref={triggerRef}
            type="button"
            onClick={handleResolveClick}
            className="btn-primary !bg-red-600 hover:!bg-red-700 flex-1 sm:flex-none min-h-touch"
          >
            <PhoneIcon className="h-4 w-4" />
            Call Parent & Resolve
          </button>
          <a
            href={`tel:${task.parentWhatsapp}`}
            className="btn-secondary flex-1 sm:flex-none min-h-touch text-center"
          >
            <PhoneIcon className="h-4 w-4" />
            Direct Call
          </a>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-labelledby="resolve-modal-title" className="animate-sheet-in relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 id="resolve-modal-title" className="font-display text-lg font-bold text-slate-900">
              Mark Call Completed
            </h2>
            <p className="mt-1 text-xs text-slate-500">{task.studentName} · {task.batchName}</p>

            <div className="mt-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Call Outcome</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'VERIFIED_SICK', label: 'Verified Sick', icon: <CheckCircleIcon className="h-4 w-4" />, tone: 'green' as const },
                  { value: 'BUNK_CONFIRMED', label: 'Bunk Confirmed', icon: <XCircleIcon className="h-4 w-4" />, tone: 'red' as const },
                  { value: 'LINE_UNREACHABLE', label: 'Line Unreachable', icon: <AlertCircleIcon className="h-4 w-4" />, tone: 'amber' as const },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedOutcome(opt.value as EscalationCallOutcome)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl p-3 border-2 transition ${selectedOutcome === opt.value
                      ? `border-${opt.tone}-600 bg-${opt.tone}-50 ring-1 ring-inset ring-${opt.tone}-200`
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`text-${opt.tone}-700`}>{opt.icon}</span>
                    <span className="text-xs font-semibold text-slate-700">{opt.label}</span>
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="staff-notes" className="field-label">
                  Staff Notes <span className="font-normal normal-case text-slate-400">(required)</span>
                </label>
                <textarea
                  id="staff-notes"
                  value={staffNotes}
                  onChange={(e) => setStaffNotes(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g., Parent confirmed student is at home with fever. Advised to bring medical certificate."
                  className="input-field resize-none"
                />
              </div>

              {resolveError && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {resolveError}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                onClick={confirmResolve}
                disabled={resolving}
                className="btn-primary !bg-red-600 hover:!bg-red-700 flex-1"
              >
                {resolving ? <><ButtonSpinner size="sm" /> Resolving…</> : 'Resolve & Log Call'}
              </button>
              <button type="button" onClick={() => setIsModalOpen(false)} disabled={resolving} className="btn-secondary flex-1">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AlertSentCard({ task }: { task: EscalationTask }): JSX.Element {
  const elapsedMinutes = task.elapsedMinutes;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  const elapsedMins = elapsedMinutes % 60;

  return (
    <div className="border-l-4 border-amber-600 bg-amber-50 p-4 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-800">ALERT SENT — Waiting for Parent Reply</span>
          <span className="ml-auto font-mono text-xs text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
            {elapsedHours > 0 ? `${elapsedHours}h ${elapsedMins}m` : `${elapsedMins}m`} since sent
          </span>
        </div>
        <h4 className="text-base font-semibold text-slate-900">{task.studentName} (Roll: {task.studentRollNumber})</h4>
        <p className="mt-1 text-xs text-slate-600">Batch: {task.batchName} • Sent at {formatClockTime(task.triggeredAt)}</p>
      </div>
      <span className="status-pill bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200">T+10 Sent</span>
    </div>
  );
}

function ParentRepliedCard({ task }: { task: EscalationTask }): JSX.Element {
  const statusColor = task.callOutcome === 'VERIFIED_SICK' ? 'green' : task.callOutcome === 'BUNK_CONFIRMED' ? 'red' : 'amber';
  const statusLabel = task.callOutcome === 'VERIFIED_SICK' ? 'Parent Verified: Leave' : task.callOutcome === 'BUNK_CONFIRMED' ? 'Parent Verified: Bunk' : 'Parent Verified: Late';

  return (
    <div className={`border-l-4 border-${statusColor}-600 bg-${statusColor}-50 p-4 rounded-xl border border-${statusColor}-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-${statusColor}-600" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-${statusColor}-800">{statusLabel}</span>
        </div>
        <h4 className="text-base font-semibold text-slate-900">{task.studentName} (Roll: {task.studentRollNumber})</h4>
        <p className="mt-1 text-xs text-slate-600">Batch: {task.batchName} • Resolved at {task.resolvedAt ? formatClockTime(task.resolvedAt) : '—'}</p>
      </div>
      <span className={`status-pill bg-${statusColor}-100 text-${statusColor}-800 ring-1 ring-inset ring-${statusColor}-200`}>Resolved</span>
    </div>
  );
}

export default function EscalationDashboard(): JSX.Element {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>('loading');
  const [tasks, setTasks] = useState<EscalationTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const today = todayInTenantTimezone();

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setError(null);

    api
      .getEscalationTasks()
      .then((result) => {
        if (!cancelled) {
          const tasksWithElapsed = result.tasks.map((task) => ({
            ...task,
            elapsedMinutes: Math.max(0, Math.floor((Date.now() - new Date(task.triggeredAt).getTime()) / 60000)),
          }));
          setTasks(tasksWithElapsed);
          setState('ready');
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load escalation tasks.');
          setState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    const accessToken = localStorage.getItem('pdo.session.accessToken');
    if (!accessToken) return;

    const socket = io('http://localhost:4000', {
      auth: { token: accessToken },
      transports: ['polling', 'websocket'],
    });

    socket.on('connect', () => {
      // Socket connected silently
    });

    socket.on('escalation:new_alert', (_data) => {
      setRefreshKey((k) => k + 1);
    });

    socket.on('attendance:status_updated', (data) => {
      console.log('[Socket] Attendance status updated', data);
      setRefreshKey((k) => k + 1);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected', reason);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  const handleResolve = useCallback((taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.taskId !== taskId));
  }, []);

  const redAlerts = tasks.filter((t) => t.callOutcome === null);
  const alertSent = tasks.filter((t) => t.callOutcome === null && t.status === 'ALERT_SENT');
  const parentReplied = tasks.filter((t) => t.callOutcome !== null);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Escalation Dashboard</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Red Alert Call Queue
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{formatDateLabel(today)}</span>
            <span className="hidden h-3 w-px bg-slate-300 sm:block" />
            <span>{user?.instituteName}</span>
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={state === 'loading'} className="btn-secondary !min-h-10 !px-4 !py-2 text-xs">
          <ClockIcon /> {state === 'loading' ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {state === 'error' && (
        <div className="card border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertCircleIcon className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-red-100 text-red-700" />
            <div>
              <p className="text-sm font-semibold text-red-800">Could not load escalation tasks</p>
              <p className="mt-1 text-xs leading-relaxed text-red-700">{error}</p>
              <button type="button" onClick={refresh} className="btn-secondary mt-3 !min-h-9 !py-1.5 text-xs">Try again</button>
            </div>
          </div>
        </div>
      )}

      {state === 'loading' && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} variant="kpi" />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard label="Red Alerts" value={redAlerts.length} hint="Unresolved call tasks" icon={<AlertCircleIcon />} tone={redAlerts.length > 0 ? 'red' : 'green'} />
        <KpiCard label="Alerts Sent" value={alertSent.length} hint="Awaiting parent reply (T+10)" icon={<ClockIcon />} tone="amber" />
        <KpiCard label="Parent Replied" value={parentReplied.length} hint="Resolved via WhatsApp" icon={<CheckCircleIcon />} tone="green" />
        <KpiCard label="Total Tasks" value={tasks.length} hint="All escalations today" icon={<AlertCircleIcon />} tone="slate" />
      </div>

      <div className="space-y-5">
        {state === 'ready' && redAlerts.length === 0 && (
          <section className="card overflow-hidden">
            <div className="border-b border-green-200 bg-green-50 px-5 py-4">
              <h2 className="font-display text-lg font-bold tracking-tight text-green-900 flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5" />
                No Active Red Alerts
              </h2>
              <p className="mt-0.5 text-xs text-green-700">All parents have replied or no absent students triggered alerts.</p>
            </div>
            <EmptyEscalation />
          </section>
        )}

        {state === 'ready' && redAlerts.length > 0 && (
          <section className="card overflow-hidden">
            <div className="border-b border-red-200 bg-red-50 px-5 py-4">
              <h2 className="font-display text-lg font-bold tracking-tight text-red-900 flex items-center gap-2">
                <AlertCircleIcon className="h-5 w-5" />
                Red Alerts — Call Required Immediately
              </h2>
              <p className="mt-0.5 text-xs text-red-700">No parent reply within 3 minutes. Call parent now and log outcome.</p>
            </div>
            <div className="p-5 space-y-4">
              {redAlerts.map((task) => (
                <RedAlertCard key={task.taskId} task={task} onResolve={handleResolve} />
              ))}
            </div>
          </section>
        )}

        {(alertSent.length > 0 || parentReplied.length > 0) && state === 'ready' && (
          <section className="card overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">Alert History</h2>
            </div>
            <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
              {[
                ...alertSent.map((t) => ({ task: t, type: 'alert' as const })),
                ...parentReplied.map((t) => ({ task: t, type: 'resolved' as const })),
              ]
                .sort((a, b) => new Date(b.task.triggeredAt).getTime() - new Date(a.task.triggeredAt).getTime())
                .map(({ task, type }) =>
                  type === 'alert' ? (
                    <AlertSentCard key={task.taskId} task={task} />
                  ) : (
                    <ParentRepliedCard key={task.taskId} task={task} />
                  ),
                )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}