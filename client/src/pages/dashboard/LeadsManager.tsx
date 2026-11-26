import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '../../lib/api';
import { formatDateLabel } from '../../lib/format';
import type { AdminLead, LeadListResult, LeadStatus } from '../../lib/types';
import { SkeletonListRow, ButtonSpinner, EmptyLeads } from '../../components/ui';

type LoadState = 'loading' | 'ready' | 'error';

function WhatsAppIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.8 14.1c-.24.68-1.4 1.3-1.94 1.34-.5.04-.98.23-3.3-.69-2.78-1.1-4.55-3.92-4.69-4.1-.14-.18-1.12-1.49-1.12-2.84s.71-2.01.96-2.29c.25-.28.55-.35.73-.35h.53c.17 0 .4-.06.62.48.24.57.8 1.95.87 2.09.07.14.12.31.02.49-.09.18-.14.29-.28.45-.14.16-.29.36-.42.48-.14.14-.28.29-.12.57.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.16-.19.69-.8.87-1.08.18-.28.37-.23.62-.14.25.09 1.6.75 1.88.89.28.14.46.21.53.32.07.12.07.68-.17 1.36z" />
    </svg>
  );
}

function PhoneIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function statusBadge(status: LeadStatus): JSX.Element {
  const variants: Record<LeadStatus, { bg: string; text: string; label: string }> = {
    NEW: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'New' },
    CONTACTED: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Contacted' },
    DEMO_SCHEDULED: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Demo Scheduled' },
    ENROLLED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Enrolled' },
    LOST: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Lost' },
  };
  const v = variants[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${v.bg} ${v.text}`}>
      {v.label}
    </span>
  );
}

export default function LeadsManager(): JSX.Element {
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<LeadListResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<LeadStatus>('NEW');
  const [editNotes, setEditNotes] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const result = await api.listLeads(page, pageSize, statusFilter || undefined);
      setData(result);
      setState('ready');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load leads');
      setState('error');
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleStatusChange = async (lead: AdminLead, newStatus: LeadStatus) => {
    setEditingId(lead.leadId);
    setEditStatus(newStatus);
    setEditNotes('');
    setSaveError(null);
  };

  const handleSaveStatus = async (leadId: string) => {
    setSavingId(leadId);
    setSaveError(null);
    try {
      await api.updateLeadStatus(leadId, { status: editStatus, notes: editNotes || undefined });
      setEditingId(null);
      loadLeads();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Failed to update status');
    } finally {
      setSavingId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setSaveError(null);
  };

  const formatWhatsAppUrl = (phone: string | null | undefined) => {
    if (!phone) return 'https://wa.me/';
    const clean = phone.replace(/[^\d]/g, '');
    return `https://wa.me/${clean}`;
  };

  const leads = data?.leads ?? [];

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Lead Pipeline</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Demo Class Requests
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage incoming demo class bookings from the P.D.O Classes website.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input-field w-auto min-h-touch"
          >
            <option value="">All Statuses</option>
            <option value="NEW">New</option>
            <option value="CONTACTED">Contacted</option>
            <option value="DEMO_SCHEDULED">Demo Scheduled</option>
            <option value="ENROLLED">Enrolled</option>
            <option value="LOST">Lost</option>
          </select>
        </div>
      </div>

      {state === 'error' ? (
        <div className="card border-red-200 bg-red-50 p-5">
          <p className="text-sm font-semibold text-red-800">Could not load leads</p>
          <p className="mt-1 text-xs leading-relaxed text-red-700">{error}</p>
          <button onClick={loadLeads} className="btn-secondary mt-3 !min-h-9 !py-1.5 text-xs">Try again</button>
        </div>
      ) : state === 'loading' ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <SkeletonListRow key={i} columns={6} />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyLeads onViewWebsite={() => window.open('/') } />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Student</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Course / Slot</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Contact</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Created</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leads.map((lead) => (
                  <tr key={lead.leadId} className="hover:bg-slate-50/50 transition">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{lead.studentName}</p>
                      {lead.notes && <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{lead.notes}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-700">{lead.targetCourse === 'CAT' ? 'CAT / MBA' : 'Class 11–12 PCM'}</p>
                      <p className="mt-0.5 text-xs text-slate-500 capitalize">{lead.preferredSlot?.toLowerCase().replace('_', ' ') || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <a href={formatWhatsAppUrl(lead.whatsappNumber)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-mono text-sm text-slate-700 hover:text-green-700 transition min-h-touch">
                        <PhoneIcon className="h-4 w-4" />
                        {lead.whatsappNumber ? lead.whatsappNumber.replace('+91', '0') : '<span class="text-slate-400">—</span>'}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {editingId === lead.leadId ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as LeadStatus)}
                            className="input-field w-auto min-h-touch"
                          >
                            <option value="NEW">New</option>
                            <option value="CONTACTED">Contacted</option>
                            <option value="DEMO_SCHEDULED">Demo Scheduled</option>
                            <option value="ENROLLED">Enrolled</option>
                            <option value="LOST">Lost</option>
                          </select>
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Notes (optional)"
                            className="input-field w-48 min-h-touch"
                            maxLength={500}
                          />
                          <button onClick={() => handleSaveStatus(lead.leadId)} disabled={savingId === lead.leadId} className="btn-primary !min-h-9 !px-3 text-xs">
                            {savingId === lead.leadId ? <><ButtonSpinner size="sm" /> Saving…</> : 'Save'}
                          </button>
                          <button onClick={handleCancelEdit} className="btn-secondary !min-h-9 !px-3 text-xs">Cancel</button>
                          {saveError && <p className="text-xs text-red-600 mt-1">{saveError}</p>}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {statusBadge(lead.status)}
                          <button
                            onClick={() => handleStatusChange(lead, lead.status === 'NEW' ? 'CONTACTED' : lead.status === 'CONTACTED' ? 'DEMO_SCHEDULED' : lead.status === 'DEMO_SCHEDULED' ? 'ENROLLED' : 'LOST')}
                            className="text-[10px] font-bold uppercase tracking-wider text-blue-700 underline"
                          >
                            Update
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-slate-500">
                      {formatDateLabel(lead.createdAt?.split('T')[0] ?? '')}
                    </td>
                    <td className="px-4 py-3">
                      <a href={formatWhatsAppUrl(lead.whatsappNumber!)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-green-700 hover:text-green-800 transition min-h-touch" title="WhatsApp follow-up">
                        <WhatsAppIcon className="h-4 w-4" />
                        <span className="text-xs font-semibold">Follow up</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.total > pageSize && (
            <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, data.total)} of {data.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary !min-h-9 !px-3 text-xs"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * pageSize >= data.total}
                  className="btn-secondary !min-h-9 !px-3 text-xs"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}