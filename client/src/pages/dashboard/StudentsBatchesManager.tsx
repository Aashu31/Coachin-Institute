import { useCallback, useEffect, useState } from 'react';

import { ApiError, api } from '../../lib/api';
import { formatTimeOfDay } from '../../lib/format';
import type {
  AdminBatch,
  AdminStudent,
  CreateBatchInput,
  CreateStudentInput,
  BulkImportResult,
} from '../../lib/types';
import { SkeletonCard, EmptyBatches, EmptyStudents } from '../../components/ui';

type Tab = 'batches' | 'students';
type LoadState = 'loading' | 'ready' | 'error';

function PlusIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function UploadIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function EditIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function Spinner(): JSX.Element {
  return (
    <span aria-hidden="true" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );
}

function formatDaysOfWeek(days: number[] | null | undefined): string {
  if (!days || days.length === 0) return '—';
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((d) => dayNames[d - 1]).join(', ');
}

export default function StudentsBatchesManager(): JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('batches');
  const [batchesState, setBatchesState] = useState<LoadState>('loading');
  const [studentsState, setStudentsState] = useState<LoadState>('loading');
  const [batches, setBatches] = useState<AdminBatch[]>([]);
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [studentBatchFilter, setStudentBatchFilter] = useState<string>('');
  const [totalStudents, setTotalStudents] = useState(0);

  // Batch form state
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchForm, setBatchForm] = useState<CreateBatchInput>({
    name: '',
    targetExam: 'CAT',
    teacherId: null,
    scheduledStartTime: '08:00:00',
    scheduledEndTime: '10:00:00',
    daysOfWeek: [1, 2, 3, 4, 5, 6],
    roomNumber: '',
    isActive: true,
  });
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchFormError, setBatchFormError] = useState<string | null>(null);

  // Student form state
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState<CreateStudentInput>({
    fullName: '',
    rollNumber: '',
    parentName: '',
    parentWhatsapp: '',
    parentSecondaryPhone: null,
    batchId: null,
    isActive: true,
  });
  const [studentSaving, setStudentSaving] = useState(false);
  const [studentFormError, setStudentFormError] = useState<string | null>(null);

  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
  const [bulkImportResult, setBulkImportResult] = useState<BulkImportResult | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);

  // Load batches
  const loadBatches = useCallback(async () => {
    setBatchesState('loading');
    setBatchesError(null);
    try {
      const result = await api.listBatchesAdmin();
      setBatches(result.batches);
      setBatchesState('ready');
    } catch (err) {
      setBatchesError(err instanceof ApiError ? err.message : 'Failed to load batches');
      setBatchesState('error');
    }
  }, []);

  // Load students
  const loadStudents = useCallback(async () => {
    setStudentsState('loading');
    setStudentsError(null);
    try {
      const result = await api.listStudents(page, pageSize, studentBatchFilter || undefined);
      setStudents(result.students);
      setTotalStudents(result.total);
      setStudentsState('ready');
    } catch (err) {
      setStudentsError(err instanceof ApiError ? err.message : 'Failed to load students');
      setStudentsState('error');
    }
  }, [page, pageSize, studentBatchFilter]);

  useEffect(() => { loadBatches(); }, [loadBatches]);
  useEffect(() => { loadStudents(); }, [loadStudents]);

  // Batch form handlers
  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBatchFormError(null);
    setBatchSaving(true);
    try {
      if (editingBatchId) {
        await api.updateBatch(editingBatchId, batchForm);
      } else {
        await api.createBatch(batchForm);
      }
      setShowBatchForm(false);
      setEditingBatchId(null);
      resetBatchForm();
      loadBatches();
    } catch (err) {
      setBatchFormError(err instanceof ApiError ? err.message : 'Failed to save batch');
    } finally {
      setBatchSaving(false);
    }
  };

  const resetBatchForm = () => {
    setBatchForm({
      name: '',
      targetExam: 'CAT',
      teacherId: null,
      scheduledStartTime: '08:00:00',
      scheduledEndTime: '10:00:00',
      daysOfWeek: [1, 2, 3, 4, 5, 6],
      roomNumber: '',
      isActive: true,
    });
  };

  const editBatch = (batch: AdminBatch) => {
    setEditingBatchId(batch.batchId);
    setBatchForm({
      name: batch.name,
      targetExam: batch.targetExam as 'CAT' | 'CLASS_12_PCM',
      teacherId: batch.teacherId,
      scheduledStartTime: batch.scheduledStartTime,
      scheduledEndTime: batch.scheduledEndTime,
      daysOfWeek: batch.daysOfWeek,
      roomNumber: batch.roomNumber ?? '',
      isActive: batch.isActive,
    });
    setShowBatchForm(true);
  };

  // Student form handlers
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentFormError(null);
    setStudentSaving(true);
    try {
      if (editingStudentId) {
        await api.updateStudent(editingStudentId, studentForm);
      } else {
        await api.createStudent(studentForm);
      }
      setShowStudentForm(false);
      setEditingStudentId(null);
      resetStudentForm();
      loadStudents();
    } catch (err) {
      setStudentFormError(err instanceof ApiError ? err.message : 'Failed to save student');
    } finally {
      setStudentSaving(false);
    }
  };

  const resetStudentForm = () => {
    setStudentForm({
      fullName: '',
      rollNumber: '',
      parentName: '',
      parentWhatsapp: '',
      parentSecondaryPhone: null,
      batchId: null,
      isActive: true,
    });
  };

  const editStudent = (student: AdminStudent) => {
    setEditingStudentId(student.studentId);
    setStudentForm({
      fullName: student.fullName,
      rollNumber: student.rollNumber,
      parentName: student.parentName,
      parentWhatsapp: student.parentWhatsapp,
      parentSecondaryPhone: student.parentSecondaryPhone,
      batchId: student.batchId,
      isActive: student.isActive,
    });
    setShowStudentForm(true);
  };

  // Sanitize CSV cell value to prevent Excel formula injection
  function sanitizeCsvCell(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    // Prefix dangerous characters with a single quote to neutralize formulas
    if (/^[@=+\-]/.test(trimmed)) {
      return `'${trimmed}`;
    }
    return trimmed;
  }

  // Bulk import handler
  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkImportFile) return;
    setBulkImporting(true);
    setBulkImportResult(null);
    try {
      const text = await bulkImportFile.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) throw new Error('CSV must have header and at least one row');

      const headers = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
      const students: CreateStudentInput[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i]!.split(',').map((v) => sanitizeCsvCell(v.trim()));
        if (values.length < 5) continue;
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = values[idx] ?? ''; });

        students.push({
          fullName: sanitizeCsvCell(row.name || row.fullname || row['full name'] || ''),
          rollNumber: sanitizeCsvCell(row.roll || row.rollnumber || row['roll number'] || ''),
          parentName: sanitizeCsvCell(row.parent || row.parentname || row['parent name'] || ''),
          parentWhatsapp: sanitizeCsvCell(row.whatsapp || row.parentwhatsapp || row['parent whatsapp'] || ''),
          parentSecondaryPhone: row.secondary || row.secondaryphone || row['secondary phone'] ? sanitizeCsvCell(row.secondary || row.secondaryphone || row['secondary phone'] || '') : null,
          batchId: row.batch || row.batchid || row['batch id'] ? sanitizeCsvCell(row.batch || row.batchid || row['batch id'] || '') : null,
          isActive: true,
        });
      }

      const result = await api.bulkImportStudents({ students });
      setBulkImportResult(result);
    } catch (err) {
      setBulkImportResult({ created: 0, updated: 0, errors: [{ row: 0, error: err instanceof Error ? err.message : 'Import failed', data: {} as CreateStudentInput }] });
    } finally {
      setBulkImporting(false);
      setBulkImportFile(null);
      loadStudents();
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            {activeTab === 'batches' ? 'Batch Management' : 'Student Management'}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {activeTab === 'batches' ? 'Academic Batches' : 'Student Roster'}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden sm:flex border-slate-200 rounded-xl overflow-hidden" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === 'batches'}
              onClick={() => setActiveTab('batches')}
              className={`px-4 py-2 text-sm font-semibold transition min-h-touch ${activeTab === 'batches' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Batches
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'students'}
              onClick={() => setActiveTab('students')}
              className={`px-4 py-2 text-sm font-semibold transition min-h-touch ${activeTab === 'students' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Students
            </button>
          </div>
          <div className="sm:hidden flex gap-2">
            <button onClick={() => setActiveTab('batches')} className={`btn-secondary ${activeTab === 'batches' ? 'bg-blue-600 text-white' : ''} min-h-touch`}>Batches</button>
            <button onClick={() => setActiveTab('students')} className={`btn-secondary ${activeTab === 'students' ? 'bg-blue-600 text-white' : ''} min-h-touch`}>Students</button>
          </div>
        </div>
      </div>

      {activeTab === 'batches' ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">All Batches</h2>
              <p className="text-xs text-slate-500">{batches.length} batch{batches.length !== 1 ? 'es' : ''} configured</p>
            </div>
            <button onClick={() => { resetBatchForm(); setEditingBatchId(null); setShowBatchForm(true); }} className="btn-primary min-h-touch">
              <PlusIcon className="h-4 w-4" /> Add Batch
            </button>
          </div>

          {batchesState === 'loading' ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <SkeletonCard key={i} variant="table" />)}</div>
          ) : batchesState === 'error' ? (
            <div className="card border-red-200 bg-red-50 p-5">
              <p className="text-sm font-semibold text-red-800">Could not load batches</p>
              <p className="mt-1 text-xs text-red-700">{batchesError}</p>
              <button onClick={loadBatches} className="btn-secondary mt-3 !min-h-9 !py-1.5 text-xs">Retry</button>
            </div>
          ) : batches.length === 0 ? (
            <EmptyBatches onCreate={() => { resetBatchForm(); setEditingBatchId(null); setShowBatchForm(true); }} />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Batch</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Course</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Schedule</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Room</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Teacher</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Students</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Status</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600 uppercase tracking-wider text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batches.map((batch) => (
                      <tr key={batch.batchId} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{batch.name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="status-pill bg-blue-100 text-blue-800">{batch.targetExam === 'CAT' ? 'CAT / MBA' : 'Class 11–12 PCM'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-sm text-slate-700">{formatTimeOfDay(batch.scheduledStartTime)} – {formatTimeOfDay(batch.scheduledEndTime)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{formatDaysOfWeek(batch.daysOfWeek)}</p>
                        </td>
                        <td className="px-4 py-3">{batch.roomNumber ?? '<span class="text-slate-400">TBD</span>'}</td>
                        <td className="px-4 py-3">{batch.teacherName ?? '<span class="text-slate-400">Unassigned</span>'}</td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-700">{batch.studentCount}</td>
                        <td className="px-4 py-3">
                          <span className={`status-pill ${batch.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                            {batch.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => editBatch(batch)} className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-800 transition min-h-touch">
                            <EditIcon className="h-4 w-4" />
                            <span className="sr-only">Edit {batch.name}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">All Students</h2>
              <p className="text-xs text-slate-500">{totalStudents} student{totalStudents !== 1 ? 's' : ''} enrolled</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={studentBatchFilter} onChange={(e) => { setStudentBatchFilter(e.target.value); setPage(1); }} className="input-field w-auto min-h-touch">
                <option value="">All Batches</option>
                {batches.filter((b) => b.isActive).map((b) => <option key={b.batchId} value={b.batchId}>{b.name}</option>)}
              </select>
              <button onClick={() => { resetStudentForm(); setEditingStudentId(null); setShowStudentForm(true); }} className="btn-primary min-h-touch">
                <PlusIcon className="h-4 w-4" /> Add Student
              </button>
              <button onClick={() => setShowBulkImport(true)} className="btn-secondary min-h-touch">
                <UploadIcon className="h-4 w-4" /> Import CSV
              </button>
            </div>
          </div>

          {studentsState === 'loading' ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <SkeletonCard key={i} variant="table" />)}</div>
          ) : studentsState === 'error' ? (
            <div className="card border-red-200 bg-red-50 p-5">
              <p className="text-sm font-semibold text-red-800">Could not load students</p>
              <p className="mt-1 text-xs text-red-700">{studentsError}</p>
              <button onClick={loadStudents} className="btn-secondary mt-3 !min-h-9 !py-1.5 text-xs">Retry</button>
            </div>
          ) : students.length === 0 ? (
            <EmptyStudents onAdd={() => { resetStudentForm(); setEditingStudentId(null); setShowStudentForm(true); }} onImport={() => setShowBulkImport(true)} />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" role="table">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Student</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Roll No</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Batch</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Parent</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">WhatsApp</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wider text-xs">Status</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-600 uppercase tracking-wider text-xs">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.map((student) => (
                      <tr key={student.studentId} className="hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{student.fullName}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-700">{student.rollNumber}</td>
                        <td className="px-4 py-3">{student.batchName ?? '<span class="text-slate-400">Unassigned</span>'}</td>
                        <td className="px-4 py-3">{student.parentName}</td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-700">{student.parentWhatsapp ? student.parentWhatsapp.replace('+91', '0') : '<span class="text-slate-400">—</span>'}</td>
                        <td className="px-4 py-3">
                          <span className={`status-pill ${student.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                            {student.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => editStudent(student)} className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-800 transition min-h-touch">
                            <EditIcon className="h-4 w-4" />
                            <span className="sr-only">Edit {student.fullName}</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalStudents > pageSize && (
                <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between">
                  <p className="text-xs text-slate-500">Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, totalStudents)} of {totalStudents}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary !min-h-9 !px-3 text-xs">Previous</button>
                    <button onClick={() => setPage((p) => p + 1)} disabled={page * pageSize >= totalStudents} className="btn-secondary !min-h-9 !px-3 text-xs">Next</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Batch Form Modal */}
      {showBatchForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={() => { setShowBatchForm(false); setEditingBatchId(null); resetBatchForm(); }} />
          <div role="dialog" aria-modal="true" className="animate-sheet-in relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="font-display text-lg font-bold text-slate-900">{editingBatchId ? 'Edit Batch' : 'Create Batch'}</h2>
            <form onSubmit={handleBatchSubmit} className="mt-4 space-y-4">
              <div>
                <label className="field-label">Batch Name</label>
                <input type="text" value={batchForm.name} onChange={(e) => setBatchForm({...batchForm, name: e.target.value})} placeholder="e.g. CAT 2026 Evening Batch" className="input-field" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label">Course</label>
                  <select value={batchForm.targetExam} onChange={(e) => setBatchForm({...batchForm, targetExam: e.target.value as 'CAT' | 'CLASS_12_PCM'})} className="input-field">
                    <option value="CAT">CAT / MBA</option>
                    <option value="CLASS_12_PCM">Class 11–12 PCM</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Teacher</label>
                  <select value={batchForm.teacherId ?? ''} onChange={(e) => setBatchForm({...batchForm, teacherId: e.target.value || null})} className="input-field">
                    <option value="">Unassigned</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label">Start Time</label>
                  <input type="time" value={batchForm.scheduledStartTime.slice(0, 5)} onChange={(e) => setBatchForm({...batchForm, scheduledStartTime: e.target.value + ':00'})} className="input-field" required />
                </div>
                <div>
                  <label className="field-label">End Time</label>
                  <input type="time" value={batchForm.scheduledEndTime.slice(0, 5)} onChange={(e) => setBatchForm({...batchForm, scheduledEndTime: e.target.value + ':00'})} className="input-field" required />
                </div>
              </div>
              <div>
                <label className="field-label">Days of Week</label>
                <div className="flex flex-wrap gap-2">
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day, idx) => (
                    <label key={day} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition min-h-touch">
                      <input type="checkbox" checked={batchForm.daysOfWeek.includes(idx + 1)} onChange={(e) => setBatchForm({...batchForm, daysOfWeek: e.target.checked ? [...batchForm.daysOfWeek, idx + 1] : batchForm.daysOfWeek.filter((d) => d !== idx + 1)})} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      {day}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="field-label">Room Number</label>
                <input type="text" value={batchForm.roomNumber ?? ''} onChange={(e) => setBatchForm({...batchForm, roomNumber: e.target.value})} placeholder="e.g. Room 201" className="input-field" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isActive" checked={batchForm.isActive} onChange={(e) => setBatchForm({...batchForm, isActive: e.target.checked})} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="isActive" className="text-sm text-slate-700">Active</label>
              </div>
              {batchFormError && <p className="text-xs text-red-600">{batchFormError}</p>}
              <div className="flex flex-col gap-2 sm:flex-row-reverse pt-2">
                <button type="submit" disabled={batchSaving} className="btn-primary flex-1 min-h-touch">{batchSaving ? <><Spinner /> Saving…</> : 'Save Batch'}</button>
                <button type="button" onClick={() => { setShowBatchForm(false); setEditingBatchId(null); resetBatchForm(); }} className="btn-secondary flex-1 min-h-touch">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Form Modal */}
      {showStudentForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={() => { setShowStudentForm(false); setEditingStudentId(null); resetStudentForm(); }} />
          <div role="dialog" aria-modal="true" className="animate-sheet-in relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-lg font-bold text-slate-900">{editingStudentId ? 'Edit Student' : 'Add Student'}</h2>
            <form onSubmit={handleStudentSubmit} className="mt-4 space-y-4">
              <div>
                <label className="field-label">Full Name</label>
                <input type="text" value={studentForm.fullName} onChange={(e) => setStudentForm({...studentForm, fullName: e.target.value})} placeholder="e.g. Aditya Mahto" className="input-field" required />
              </div>
              <div>
                <label className="field-label">Roll Number</label>
                <input type="text" value={studentForm.rollNumber} onChange={(e) => setStudentForm({...studentForm, rollNumber: e.target.value})} placeholder="e.g. CAT-2026-001" className="input-field" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label">Parent Name</label>
                  <input type="text" value={studentForm.parentName} onChange={(e) => setStudentForm({...studentForm, parentName: e.target.value})} placeholder="e.g. Ramesh Mahto" className="input-field" required />
                </div>
                <div>
                  <label className="field-label">Batch</label>
                  <select value={studentForm.batchId ?? ''} onChange={(e) => setStudentForm({...studentForm, batchId: e.target.value || null})} className="input-field">
                    <option value="">Unassigned</option>
                    {batches.filter((b) => b.isActive).map((b) => <option key={b.batchId} value={b.batchId}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="field-label">Parent WhatsApp</label>
                <input type="tel" value={studentForm.parentWhatsapp} onChange={(e) => setStudentForm({...studentForm, parentWhatsapp: e.target.value})} placeholder="+91 98351 12401" className="input-field" required />
              </div>
              <div>
                <label className="field-label">Secondary Phone (optional)</label>
                <input type="tel" value={studentForm.parentSecondaryPhone ?? ''} onChange={(e) => setStudentForm({...studentForm, parentSecondaryPhone: e.target.value || null})} placeholder="+91 98351 12501" className="input-field" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="studentIsActive" checked={studentForm.isActive} onChange={(e) => setStudentForm({...studentForm, isActive: e.target.checked})} className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="studentIsActive" className="text-sm text-slate-700">Active</label>
              </div>
              {studentFormError && <p className="text-xs text-red-600">{studentFormError}</p>}
              <div className="flex flex-col gap-2 sm:flex-row-reverse pt-2">
                <button type="submit" disabled={studentSaving} className="btn-primary flex-1 min-h-touch">{studentSaving ? <><Spinner /> Saving…</> : 'Save Student'}</button>
                <button type="button" onClick={() => { setShowStudentForm(false); setEditingStudentId(null); resetStudentForm(); }} className="btn-secondary flex-1 min-h-touch">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={() => { setShowBulkImport(false); setBulkImportResult(null); setBulkImportFile(null); }} />
          <div role="dialog" aria-modal="true" className="animate-sheet-in relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="font-display text-lg font-bold text-slate-900">Bulk Import Students (CSV)</h2>
            <p className="mt-1 text-sm text-slate-500">Upload a CSV with columns: Name, Roll Number, Parent Name, Parent WhatsApp, Secondary Phone (optional), Batch ID (optional)</p>
            {!bulkImportResult ? (
              <form onSubmit={handleBulkImport} className="mt-4 space-y-4">
                <div>
                  <label className="field-label">CSV File</label>
                  <input type="file" accept=".csv" onChange={(e) => setBulkImportFile(e.target.files?.[0] ?? null)} className="input-field" required />
                  {bulkImportFile && <p className="mt-1 text-xs text-slate-500">Selected: {bulkImportFile.name}</p>}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row-reverse pt-2">
                  <button type="submit" disabled={bulkImporting || !bulkImportFile} className="btn-primary flex-1 min-h-touch">{bulkImporting ? <><Spinner /> Importing…</> : 'Import Students'}</button>
                  <button type="button" onClick={() => { setShowBulkImport(false); setBulkImportFile(null); }} className="btn-secondary flex-1 min-h-touch">Cancel</button>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl bg-green-50 p-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-green-700">Created</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-green-800">{bulkImportResult.created}</p>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Updated</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-blue-800">{bulkImportResult.updated}</p>
                  </div>
                  <div className="rounded-xl bg-red-50 p-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Errors</p>
                    <p className="mt-1 font-mono text-2xl font-bold text-red-800">{bulkImportResult.errors.length}</p>
                  </div>
                </div>
                {bulkImportResult.errors.length > 0 && (
                  <div className="rounded-xl bg-red-50 p-4 max-h-64 overflow-y-auto">
                    <p className="text-xs font-bold uppercase tracking-wider text-red-700 mb-2">Error Details</p>
                    <ul className="space-y-1 text-xs text-red-900">
                      {bulkImportResult.errors.slice(0, 10).map((err, idx) => (
                        <li key={idx}>Row {err.row}: {err.error}</li>
                      ))}
                      {bulkImportResult.errors.length > 10 && <li className="text-red-600">+ {bulkImportResult.errors.length - 10} more errors</li>}
                    </ul>
                  </div>
                )}
                <div className="flex flex-col gap-2 sm:flex-row-reverse pt-2">
                  <button onClick={() => { setShowBulkImport(false); setBulkImportResult(null); setBulkImportFile(null); loadStudents(); }} className="btn-primary flex-1 min-h-touch">Done</button>
                  <button onClick={() => { setBulkImportResult(null); setBulkImportFile(null); }} className="btn-secondary flex-1 min-h-touch">Import Another</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}