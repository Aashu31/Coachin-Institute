import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { formatDateLabel } from '../../lib/format';
import type { DailyAttendanceReport } from '../../lib/types';
import { SkeletonCard, EmptyAnalytics } from '../../components/ui';

type LoadState = 'loading' | 'ready' | 'error';

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

function ClockIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
    </svg>
  );
}

function DownloadIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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

export default function AttendanceAnalytics(): JSX.Element {
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>('loading');
  const [report, setReport] = useState<DailyAttendanceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const loadReport = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const result = await api.getDailyAttendanceReport(selectedDate);
      setReport(result.report);
      setState('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load attendance report');
      setState('error');
    }
  }, [selectedDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  // Sanitize CSV cell value to prevent Excel formula injection
  function sanitizeCsvCell(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    if (/^[@=+\-]/.test(trimmed)) {
      return `'${trimmed}`;
    }
    return trimmed;
  }

  const handleExportCsv = () => {
    if (!report) return;
    const rows = [
      ['Date', report.date],
      ['Total Students', String(report.totalStudents)],
      ['Present', String(report.presentCount)],
      ['Absent', String(report.absentCount)],
      ['Present %', `${report.presentPercentage}%`],
      ['Avg Parent Response (min)', report.avgParentResponseTimeMinutes?.toString() ?? 'N/A'],
      ['Unresolved Red Alerts', String(report.unresolvedRedAlerts)],
      [],
      ['Batch', 'Start Time', 'Total', 'Present', 'Absent', 'Present %', 'Avg Response (min)', 'Red Alerts'],
      ...report.batches.map((b) => [
        sanitizeCsvCell(b.batchName),
        sanitizeCsvCell(b.scheduledStartTime),
        sanitizeCsvCell(String(b.totalStudents)),
        sanitizeCsvCell(String(b.presentCount)),
        sanitizeCsvCell(String(b.absentCount)),
        sanitizeCsvCell(`${b.presentPercentage}%`),
        sanitizeCsvCell(b.avgParentResponseTimeMinutes?.toString() ?? 'N/A'),
        sanitizeCsvCell(String(b.unresolvedRedAlerts)),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${sanitizeCsvCell(c)}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-report-${report.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (state === 'error') {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="card border-red-200 bg-red-50 p-5">
          <p className="text-sm font-semibold text-red-800">Could not load report</p>
          <p className="mt-1 text-xs leading-relaxed text-red-700">{error}</p>
          <button onClick={loadReport} className="btn-secondary mt-3 !min-h-9 !py-1.5 text-xs">Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Daily Attendance Report</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {formatDateLabel(selectedDate ?? '')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Batch-wise attendance summary, parent response times, and escalation status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={selectedDate ?? ''}
            onChange={handleDateChange}
            max={new Date().toISOString().split('T')[0]}
            className="input-field w-auto min-h-touch"
          />
          <button onClick={loadReport} disabled={state === 'loading'} className="btn-secondary !min-h-10 !px-4 !py-2 text-xs">
            <RefreshIcon /> {state === 'loading' ? 'Refreshing…' : 'Refresh'}
          </button>
          {report && (
            <button onClick={handleExportCsv} className="btn-dark !min-h-10 !px-4 !py-2 text-xs">
              <DownloadIcon className="h-4 w-4" /> Export CSV
            </button>
          )}
        </div>
      </div>

      {state === 'loading' && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} variant="kpi" />
          ))}
        </div>
      )}

      {report && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <KpiCard
              label="Total Students"
              value={report.totalStudents}
              hint={`${report.presentCount} present · ${report.absentCount} absent`}
              icon={<UsersIcon />}
              tone="blue"
            />
            <KpiCard
              label="Present Rate"
              value={`${report.presentPercentage}%`}
              hint={report.absentCount > 0 ? `${report.absentCount} absent today` : 'Perfect attendance'}
              icon={<CheckCircleIcon />}
              tone={report.absentCount === 0 ? 'green' : 'amber'}
            />
            <KpiCard
              label="Avg Parent Response"
              value={report.avgParentResponseTimeMinutes ? `${report.avgParentResponseTimeMinutes} min` : '—'}
              hint="Time from WhatsApp dispatch to parent reply"
              icon={<ClockIcon />}
              tone="slate"
            />
            <KpiCard
              label="Red Alerts"
              value={report.unresolvedRedAlerts}
              hint="Unresolved escalation tasks"
              icon={<AlertIcon />}
              tone={report.unresolvedRedAlerts > 0 ? 'red' : 'green'}
            />
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-display text-lg font-bold tracking-tight text-slate-900">Batch-wise Breakdown</h2>
              <p className="mt-0.5 text-xs text-slate-500">Attendance details for each active batch on {formatDateLabel(selectedDate ?? '')}</p>
            </div>
            {report.batches.length === 0 ? (
              <EmptyAnalytics onSelectDate={() => { /* focus date input */ }} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Batch</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Time</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Total</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Present</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Absent</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Present %</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Avg Response</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Red Alerts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {report.batches.map((batch) => (
                      <tr key={batch.batchId} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{batch.batchName}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-700">{batch.scheduledStartTime}</td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-700">{batch.totalStudents}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-bold text-green-700">{batch.presentCount}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-bold text-red-700">{batch.absentCount}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-24 h-2 rounded-full bg-red-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-green-500 transition-all"
                              style={{ width: `${batch.presentPercentage}%` }}
                            />
                          </div>
                          <p className="mt-0.5 font-mono text-xs font-bold text-slate-700">{batch.presentPercentage}%</p>
                        </td>
                        <td className="px-4 py-3">
                          {batch.avgParentResponseTimeMinutes ? (
                            <span className="font-mono text-sm font-bold text-slate-700">{batch.avgParentResponseTimeMinutes} min</span>
                          ) : (
                            <span className="text-xs text-slate-400">No replies</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`status-pill ${batch.unresolvedRedAlerts > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                            {batch.unresolvedRedAlerts > 0 ? `${batch.unresolvedRedAlerts} alert${batch.unresolvedRedAlerts > 1 ? 's' : ''}` : 'Clear'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-display text-base font-bold text-slate-900">Key Metrics & Notes</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Report Generated</dt>
                <dd className="mt-1 font-mono text-slate-900">{new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Timezone</dt>
                <dd className="mt-1 font-mono text-slate-900">Asia/Kolkata</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Institute</dt>
                <dd className="mt-1 font-semibold text-slate-900">{user?.instituteName ?? 'P.D.O Classes'}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Data Source</dt>
                <dd className="mt-1 text-slate-900">Live from locked attendance sheets (RLS-enforced)</dd>
              </div>
            </dl>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
              <strong>Note:</strong> Present % is calculated from teacher-submitted attendance sheets. Parent response time measures
              the interval between WhatsApp dispatch (T+10 min) and parent button tap. Red Alerts reflect unresolved
              escalation tasks where no parent reply was received within the 3-minute window.
            </p>
          </div>
        </>
      )}
    </div>
  );
}