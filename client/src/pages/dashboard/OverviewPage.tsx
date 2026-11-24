import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';

import { ApiError, api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { BUSINESS } from '../../lib/business';
import { formatDateLabel, formatDateTime, formatTimeOfDay, todayInTenantTimezone } from '../../lib/format';
import { isAdminRole, roleLabel } from '../../lib/roles';
import type { BatchListResult, BatchSummary } from '../../lib/types';

type LoadState = 'loading' | 'ready' | 'error';

function CalendarIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function UsersIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 21v-2a4 4 0 00-3-3.87M16 3.13A4 4 0 0119 7a4 4 0 01-3 3.87" />
    </svg>
  );
}

function CheckCircleIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12.5l2.5 2.5L16 9.5" />
    </svg>
  );
}

function AlertIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    </svg>
  );
}

function RefreshIcon({ className = 'h-4 w-4' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-2.6-6.4M21 3v6h-6" />
    </svg>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  hint: string;
  icon: JSX.Element;
  tone: 'blue' | 'green' | 'amber' | 'red' | 'slate';
}

const KPI_TONES: Readonly<Record<KpiCardProps['tone'], string>> = {
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
          <p className="mt-1.5 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {value}
          </p>
        </div>
        <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ring-1 ring-inset ${KPI_TONES[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{hint}</p>
    </div>
  );
}

function BatchStatus({ batch }: { batch: BatchSummary }): JSX.Element {
  if (batch.attendanceStatus === 'SUBMITTED') {
    return <span className="status-pill bg-green-100 text-green-800">Submitted</span>;
  }

  if (batch.attendanceStatus === 'PENDING') {
    return <span className="status-pill bg-amber-100 text-amber-800">Marking pending</span>;
  }

  return <span className="status-pill bg-slate-100 text-slate-600">Not scheduled today</span>;
}

function greeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 17) {
    return 'Good afternoon';
  }

  return 'Good evening';
}

export default function OverviewPage(): JSX.Element {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<BatchListResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const isTeacher = user?.role === 'TEACHER';

  useEffect(() => {
    if (isTeacher) {
      return;
    }

    let cancelled = false;
    setState('loading');
    setError(null);

    api
      .listBatches()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setState('ready');
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof ApiError
              ? loadError.message
              : 'The batch list could not be loaded. Check that the API is running.',
          );
          setState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isTeacher, refreshKey]);

  const refresh = useCallback((): void => {
    setRefreshKey((current) => current + 1);
  }, []);

  if (isTeacher) {
    return <Navigate to="/app/teacher" replace />;
  }

  const batches = data?.batches ?? [];
  const todayBatches = batches.filter((batch) => batch.isScheduledToday);
  const visibleBatches = todayBatches.length > 0 ? todayBatches : batches;
  const submitted = todayBatches.filter((batch) => batch.attendanceStatus === 'SUBMITTED');
  const pending = todayBatches.filter((batch) => batch.attendanceStatus === 'PENDING');
  const enrolled = batches.reduce((total, batch) => total + batch.studentCount, 0);
  const presentToday = submitted.reduce((total, batch) => total + batch.presentCount, 0);
  const absentToday = submitted.reduce((total, batch) => total + batch.absentCount, 0);
  const today = data?.today ?? todayInTenantTimezone();

  const firstName = user?.fullName.split(' ')[0] ?? 'there';
  const audience = user ? (isAdminRole(user.role) ? 'Owner workspace' : 'Front desk workspace') : 'Workspace';

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{audience}</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {greeting()}, {firstName}.
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{formatDateLabel(today)}</span>
            <span className="hidden h-3 w-px bg-slate-300 sm:block" />
            <span>
              {user ? `${roleLabel(user.role)} · ${user.instituteName}` : BUSINESS.name}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={state === 'loading'}
          className="btn-secondary !min-h-10 !px-4 !py-2 text-xs"
        >
          <RefreshIcon />
          {state === 'loading' ? 'Refreshing…' : 'Refresh live data'}
        </button>
      </div>

      {state === 'error' ? (
        <div className="card border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-red-100 text-red-700">
              <AlertIcon />
            </span>
            <div>
              <p className="text-sm font-semibold text-red-800">Could not load the workspace</p>
              <p className="mt-1 text-xs leading-relaxed text-red-700">{error}</p>
              <button type="button" onClick={refresh} className="btn-secondary mt-3 !min-h-9 !py-1.5 text-xs">
                Try again
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard
          label="Today's batches"
          value={String(todayBatches.length)}
          hint={`${batches.length} active batches in the institute`}
          icon={<CalendarIcon />}
          tone="blue"
        />
        <KpiCard
          label="Students enrolled"
          value={String(enrolled)}
          hint="Active students across all batches"
          icon={<UsersIcon />}
          tone="slate"
        />
        <KpiCard
          label="Attendance in"
          value={`${submitted.length}/${todayBatches.length}`}
          hint={
            todayBatches.length === 0
              ? 'No class scheduled today'
              : `${pending.length} batch${pending.length === 1 ? '' : 'es'} still to mark`
          }
          icon={<CheckCircleIcon />}
          tone={todayBatches.length > 0 && pending.length > 0 ? 'amber' : 'green'}
        />
        <KpiCard
          label="Absent today"
          value={String(absentToday)}
          hint={`${presentToday} present across submitted sheets`}
          icon={<AlertIcon />}
          tone={absentToday > 0 ? 'red' : 'green'}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">
                {todayBatches.length > 0 ? "Today's timetable" : 'Active batches'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {todayBatches.length > 0
                  ? 'Open a batch to take or review the attendance sheet.'
                  : 'No batch is scheduled today. Showing the full active timetable.'}
              </p>
            </div>
            <Link to="/app/teacher" className="text-xs font-semibold text-blue-700 hover:text-blue-800">
              Open attendance desk →
            </Link>
          </div>

          {state === 'loading' ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : visibleBatches.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">No active batches yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Ask the institute admin to assign a batch before taking attendance.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {visibleBatches.map((batch) => (
                <li key={batch.batchId} className="px-4 py-4 transition hover:bg-slate-50/70 sm:px-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-12 w-16 flex-none flex-col items-center justify-center rounded-xl bg-slate-900 text-white">
                        <span className="font-mono text-[11px] font-bold leading-none">
                          {formatTimeOfDay(batch.scheduledStartTime)}
                        </span>
                        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-slate-400">
                          start
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{batch.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {batch.teacherName ?? 'Faculty not assigned'} · {batch.roomNumber ?? 'Room TBD'}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <BatchStatus batch={batch} />
                          <span className="text-[10px] font-medium text-slate-500">
                            {batch.studentCount} students
                          </span>
                          {batch.attendanceStatus === 'SUBMITTED' ? (
                            <span className="text-[10px] text-slate-500">
                              {batch.presentCount} present · {batch.absentCount} absent
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                      {batch.submittedAt ? (
                        <span className="text-[10px] text-slate-500">
                          Submitted {formatDateTime(batch.submittedAt)}
                        </span>
                      ) : null}
                      <Link
                        to={`/app/teacher?batchId=${batch.batchId}`}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700"
                      >
                        {batch.attendanceStatus === 'SUBMITTED' ? 'Review sheet' : 'Take attendance'}
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-5">
          <section className="card overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">
                Attendance snapshot
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Live from the locked digital sheets.</p>
            </div>
            <div className="p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Present rate
                  </p>
                  <p className="mt-1 font-display text-3xl font-extrabold text-slate-900">
                    {presentToday + absentToday === 0
                      ? '—'
                      : `${Math.round((presentToday / (presentToday + absentToday)) * 100)}%`}
                  </p>
                </div>
                <span className="status-pill bg-green-100 text-green-800">
                  {presentToday} present
                </span>
              </div>

              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-red-100">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{
                    width:
                      presentToday + absentToday === 0
                        ? '0%'
                        : `${Math.round((presentToday / (presentToday + absentToday)) * 100)}%`,
                  }}
                />
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-green-50 px-3 py-2.5">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-green-700">
                    Present
                  </dt>
                  <dd className="mt-0.5 font-mono text-lg font-bold text-green-800">{presentToday}</dd>
                </div>
                <div className="rounded-xl bg-red-50 px-3 py-2.5">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-red-700">
                    Absent
                  </dt>
                  <dd className="mt-0.5 font-mono text-lg font-bold text-red-800">{absentToday}</dd>
                </div>
              </dl>

              <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                Absent marks are saved as <span className="font-mono text-[10px]">ABSENT_UNCONFIRMED</span>{' '}
                and become the Phase 2 WhatsApp verification queue at T+10.
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-red-200 bg-red-50 shadow-sm">
            <div className="border-b border-red-200 px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold tracking-tight text-red-900">
                  Red Alert queue
                </h2>
                <span className="status-pill bg-red-600 text-white">Phase 2</span>
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-red-100 text-red-700">
                  <AlertIcon />
                </span>
                <div>
                  <p className="text-sm font-semibold text-red-900">
                    The escalation dashboard is not live yet.
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-red-800/80">
                    Phase 2 adds WhatsApp quick-replies at T+10 and a one-tap parent call queue at
                    T+13. Phase 1 already locks attendance, so no one can quietly change a mark.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'T+0', detail: 'Sheet locks' },
                  { label: 'T+10', detail: 'WhatsApp' },
                  { label: 'T+13', detail: 'Red Alert' },
                ].map((step) => (
                  <div key={step.label} className="rounded-lg bg-white/70 px-2 py-2 ring-1 ring-inset ring-red-200">
                    <p className="font-mono text-xs font-bold text-red-800">{step.label}</p>
                    <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-red-700/70">
                      {step.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-display text-base font-bold text-slate-900">Quick links</h2>
            <div className="mt-3 flex flex-col gap-2">
              <Link
                to="/app/teacher"
                className="flex min-h-11 items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
              >
                Teacher attendance sheet
                <span aria-hidden="true">→</span>
              </Link>
              <a
                href="/#demo"
                className="flex min-h-11 items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
              >
                Public demo booking page
                <span aria-hidden="true">↗</span>
              </a>
            </div>
            <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
              Parent WhatsApp numbers are intentionally excluded from every client API response.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
