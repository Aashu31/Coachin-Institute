import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { registerInstituteSchema, registerStep1Schema, registerStep2Schema, registerStep3Schema } from '../lib/validation';
import { useApiErrorToast } from '../components/ui';

type Step = 1 | 2 | 3 | 'verify';

interface FormData {
  // Step 1: Admin Account
  adminFullName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  confirmPassword: string;
  // Step 2: Institute Details
  instituteName: string;
  instituteSlug: string;
  institutePhone: string;
  instituteEmail: string;
  instituteAddress: string;
  instituteCity: string;
  // Step 3: First Batch
  batchName: string;
  targetCourse: 'CAT' | 'CLASS_12_PCM';
  scheduledStartTime: string;
  scheduledEndTime: string;
  daysOfWeek: number[];
  roomNumber: string;
}

const initialFormData: FormData = {
  adminFullName: '',
  adminEmail: '',
  adminPhone: '',
  adminPassword: '',
  confirmPassword: '',
  instituteName: '',
  instituteSlug: '',
  institutePhone: '',
  instituteEmail: '',
  instituteAddress: '',
  instituteCity: 'Ranchi',
  batchName: '',
  targetCourse: 'CAT',
  scheduledStartTime: '16:00',
  scheduledEndTime: '18:00',
  daysOfWeek: [1, 2, 3, 4, 5, 6],
  roomNumber: '',
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function RegisterPage(): JSX.Element {
  const { registerInstitute } = useAuth();
  const showApiError = useApiErrorToast();

  const [step, setStep] = useState<Step>(1);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ): void => {
    const { name, value, type } = event.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? (event.target as HTMLInputElement).checked : value }));
  };

  const handleCheckboxChange = (day: number, checked: boolean): void => {
    setFormData((prev) => ({
      ...prev,
      daysOfWeek: checked
        ? [...prev.daysOfWeek, day].sort((a, b) => a - b)
        : prev.daysOfWeek.filter((d) => d !== day),
    }));
  };

  const validateStep = (): boolean => {
    const parsed = (() => {
      if (step === 1) return registerStep1Schema.safeParse(formData);
      if (step === 2) return registerStep2Schema.safeParse(formData);
      if (step === 3) return registerStep3Schema.safeParse(formData);
      return registerInstituteSchema.safeParse(formData);
    })();

    if (!parsed.success) {
      // Show first error as toast
      showApiError(parsed.error, 'Validation failed');
      return false;
    }
    return true;
  };

  const handleNext = (): void => {
    if (validateStep()) {
      setStep((current) => (current === 1 ? 2 : current === 2 ? 3 : 'verify'));
    }
  };

  const handleBack = (): void => {
    setStep((current) => (current === 2 ? 1 : current === 3 ? 2 : 1));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!validateStep()) return;

    setSubmitting(true);

    try {
      await registerInstitute({
        instituteName: formData.instituteName.trim(),
        instituteSlug: formData.instituteSlug.trim().toLowerCase(),
        institutePhone: formData.institutePhone.trim(),
        instituteEmail: formData.instituteEmail.trim().toLowerCase(),
        instituteAddress: formData.instituteAddress.trim(),
        instituteCity: formData.instituteCity.trim(),
        adminFullName: formData.adminFullName.trim(),
        adminEmail: formData.adminEmail.trim().toLowerCase(),
        adminPhone: formData.adminPhone.trim(),
        adminPassword: formData.adminPassword,
        confirmPassword: formData.confirmPassword,
      });
      setStep('verify');
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        showApiError(submitError, 'Registration failed');
      } else {
        showApiError(submitError, 'Could not reach the API. Check that the server is running and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const progressSteps = [
    { num: 1, label: 'Admin Account', href: '#' },
    { num: 2, label: 'Institute Details', href: '#' },
    { num: 3, label: 'First Batch', href: '#' },
    { num: 4, label: 'Verify Email', href: '#' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
        {/* Progress indicator */}
        <nav className="mb-8" aria-label="Registration progress">
          <ol className="flex items-center">
            {progressSteps.map((s, idx) => (
              <li key={s.num} className="flex items-center">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition ${
                    (step === 'verify' ? 4 : step) >= s.num
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {s.num}
                </span>
                {idx < progressSteps.length - 1 && (
                  <span
                    className={`hidden h-1 w-16 mx-2 ${(step === 'verify' ? 4 : step) > s.num ? 'bg-blue-600' : 'bg-slate-200'} sm:block`}
                    aria-hidden="true"
                  />
                )}
              </li>
            ))}
          </ol>
          <div className="mt-4 flex justify-between text-xs text-slate-500 sm:px-2">
            {progressSteps.map((s) => (
              <span key={s.num} className={`font-medium ${(step === 'verify' ? 4 : step) >= s.num ? 'text-slate-900' : ''}`}>
                {s.label}
              </span>
            ))}
          </div>
        </nav>

        <div className="card p-6 sm:p-8">
          {step !== 'verify' && (
            <>
              <div className="mb-6">
                <Link to="/login" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
                  ← Back to sign in
                </Link>
              </div>

              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {step === 1 && 'Create your admin account'}
                {step === 2 && 'Tell us about your institute'}
                {step === 3 && 'Create your first batch'}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {step === 1 && 'This account will have full administrative access to your institute.'}
                {step === 2 && 'These details will appear on your public profile and parent communications.'}
                {step === 3 && 'You can add more batches later from the dashboard.'}
              </p>
            </>
          )}

          {step === 1 && (
            <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-5" noValidate>
              <div>
                <label htmlFor="adminFullName" className="field-label">
                  Full name
                </label>
                <input
                  id="adminFullName"
                  name="adminFullName"
                  type="text"
                  autoComplete="name"
                  required
                  value={formData.adminFullName}
                  onChange={handleChange}
                  placeholder="Prakash Dev Ojha"
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="adminEmail" className="field-label">
                  Email address
                </label>
                <input
                  id="adminEmail"
                  name="adminEmail"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={formData.adminEmail}
                  onChange={handleChange}
                  placeholder="admin@yourinstitute.in"
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="adminPhone" className="field-label">
                  Mobile number
                </label>
                <input
                  id="adminPhone"
                  name="adminPhone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  value={formData.adminPhone}
                  onChange={handleChange}
                  placeholder="10-digit mobile number"
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="adminPassword" className="field-label">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="adminPassword"
                    name="adminPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={formData.adminPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="input-field pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex w-16 items-center justify-center rounded-r-xl text-xs font-semibold text-slate-500 transition hover:text-slate-900"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="field-label">
                  Confirm password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="input-field pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex w-16 items-center justify-center rounded-r-xl text-xs font-semibold text-slate-500 transition hover:text-slate-900"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Continuing…' : 'Continue'}
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="space-y-5" noValidate>
              <div>
                <label htmlFor="instituteName" className="field-label">
                  Institute name
                </label>
                <input
                  id="instituteName"
                  name="instituteName"
                  type="text"
                  required
                  value={formData.instituteName}
                  onChange={handleChange}
                  placeholder="P.D.O Classes"
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="instituteSlug" className="field-label">
                  Institute slug <span className="font-normal normal-case text-slate-400">(for your subdomain)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    https://
                  </span>
                  <input
                    id="instituteSlug"
                    name="instituteSlug"
                    type="text"
                    required
                    value={formData.instituteSlug}
                    onChange={handleChange}
                    placeholder="pdoclasses"
                    className="input-field pl-20"
                    pattern="^[a-z0-9-]+$"
                  />
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
                    .pdoclasses.in
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-500">Lowercase letters, numbers, and hyphens only.</p>
              </div>

              <div>
                <label htmlFor="institutePhone" className="field-label">
                  Institute phone
                </label>
                <input
                  id="institutePhone"
                  name="institutePhone"
                  type="tel"
                  inputMode="tel"
                  required
                  value={formData.institutePhone}
                  onChange={handleChange}
                  placeholder="083404 06593"
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="instituteEmail" className="field-label">
                  Institute email
                </label>
                <input
                  id="instituteEmail"
                  name="instituteEmail"
                  type="email"
                  inputMode="email"
                  required
                  value={formData.instituteEmail}
                  onChange={handleChange}
                  placeholder="admissions@yourinstitute.in"
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="instituteAddress" className="field-label">
                  Address
                </label>
                <textarea
                  id="instituteAddress"
                  name="instituteAddress"
                  rows={3}
                  required
                  value={formData.instituteAddress}
                  onChange={handleChange}
                  placeholder="P&T Colony, Lalpur, Ranchi, Jharkhand 834001"
                  className="input-field resize-none"
                />
              </div>

              <div>
                <label htmlFor="instituteCity" className="field-label">
                  City
                </label>
                <input
                  id="instituteCity"
                  name="instituteCity"
                  type="text"
                  required
                  value={formData.instituteCity}
                  onChange={handleChange}
                  placeholder="Ranchi"
                  className="input-field"
                />
              </div>

              <div className="pt-2 flex justify-between">
                <button type="button" onClick={handleBack} className="btn-secondary">
                  Back
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Continuing…' : 'Continue'}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="batchName" className="field-label">
                  Batch name
                </label>
                <input
                  id="batchName"
                  name="batchName"
                  type="text"
                  required
                  value={formData.batchName}
                  onChange={handleChange}
                  placeholder="CAT 2026 Evening Batch"
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="targetCourse" className="field-label">
                  Target course
                </label>
                <select
                  id="targetCourse"
                  name="targetCourse"
                  value={formData.targetCourse}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="CAT">CAT / MBA Entrance</option>
                  <option value="CLASS_12_PCM">Class 11–12 PCM</option>
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="scheduledStartTime" className="field-label">
                    Start time
                  </label>
                  <input
                    id="scheduledStartTime"
                    name="scheduledStartTime"
                    type="time"
                    required
                    value={formData.scheduledStartTime}
                    onChange={handleChange}
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="scheduledEndTime" className="field-label">
                    End time
                  </label>
                  <input
                    id="scheduledEndTime"
                    name="scheduledEndTime"
                    type="time"
                    required
                    value={formData.scheduledEndTime}
                    onChange={handleChange}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Days of week</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map((label, idx) => (
                    <label
                      key={label}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium cursor-pointer transition ${
                        formData.daysOfWeek.includes(idx + 1)
                          ? 'border-blue-300 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.daysOfWeek.includes(idx + 1)}
                        onChange={(e) => handleCheckboxChange(idx + 1, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="roomNumber" className="field-label">
                  Room number <span className="font-normal normal-case text-slate-400">(optional)</span>
                </label>
                <input
                  id="roomNumber"
                  name="roomNumber"
                  type="text"
                  value={formData.roomNumber}
                  onChange={handleChange}
                  placeholder="Room 201"
                  className="input-field"
                />
              </div>

              <div className="pt-2 flex justify-between">
                <button type="button" onClick={handleBack} className="btn-secondary">
                  Back
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Creating institute…' : 'Create institute'}
                </button>
              </div>
            </form>
          )}

          {step === 'verify' && (
            <div className="text-center py-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-8 w-8">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-slate-900">Institute created!</h2>
              <p className="mt-2 text-sm text-slate-600">
                We&apos;ve sent a verification email to <strong>{formData.adminEmail}</strong>.
                Please check your inbox and click the link to verify your account.
              </p>
              <p className="mt-4 text-xs text-slate-500">
                Didn&apos;t receive the email? Check your spam folder or{' '}
                <button
                  type="button"
                  onClick={() => api.resendVerification(formData.adminEmail).then(() => alert('Verification email resent!'))}
                  className="font-semibold text-blue-700 hover:text-blue-800 underline"
                >
                  resend
                </button>.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link to="/login" className="btn-primary">
                  Continue to sign in
                </Link>
                <Link to="/" className="btn-secondary">
                  Back to website
                </Link>
              </div>
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          By creating an institute, you agree to our{' '}
          <a href="/terms" className="font-semibold text-blue-700 hover:text-blue-800 underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="font-semibold text-blue-700 hover:text-blue-800 underline">
            Privacy Policy
          </a>.
        </p>
      </div>
    </div>
  );
}