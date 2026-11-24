import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../lib/api';
import { ApiError } from '../lib/api';
import { BUSINESS } from '../lib/business';
import { forgotPasswordSchema } from '../lib/validation';
import { useApiErrorToast } from '../components/ui';

export default function ForgotPasswordPage(): JSX.Element {
  const showApiError = useApiErrorToast();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const parsed = forgotPasswordSchema.safeParse({ email: email.trim() });
    if (!parsed.success) {
      showApiError(parsed.error, 'Validation failed');
      return;
    }

    setSubmitting(true);

    try {
      await api.forgotPassword(parsed.data.email);
      setSubmitted(true);
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        showApiError(submitError, 'Failed to send reset email');
      } else {
        showApiError(submitError, 'Could not reach the API. Check that the server is running and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[1.05fr_0.95fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-brand-900 p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-24 top-16 h-80 w-80 rounded-full bg-primary-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 font-display text-xs font-extrabold tracking-tight text-white ring-1 ring-white/15">
              PDO
            </span>
            <span>
              <span className="block font-display text-sm font-bold text-white">{BUSINESS.name}</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Lalpur · Ranchi
              </span>
            </span>
          </Link>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-balance font-display text-3xl font-extrabold leading-[1.1] tracking-tight text-white">
            Reset your password securely.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Enter your institute email address. If an account exists, we&apos;ll send a password reset link.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {[
              'Reset links expire after 1 hour for security',
              'Links can only be used once',
              'Contact support if you don&apos;t receive the email',
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                  ✓
                </span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
            P.D.O Classes · P&T Colony
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {BUSINESS.address}
            <br />
            <span className="font-mono text-amber-300">{BUSINESS.phoneDisplay}</span>
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen flex-col justify-center px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link to="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-900 font-display text-xs font-extrabold text-white">
                PDO
              </span>
              <span>
                <span className="block font-display text-sm font-bold text-slate-900">
                  {BUSINESS.name}
                </span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Lalpur · Ranchi
                </span>
              </span>
            </Link>
            <Link to="/login" className="text-xs font-semibold text-blue-700 hover:text-blue-800">
              Back to sign in
            </Link>
          </div>

          <div className="card p-6 sm:p-7">
            {submitted ? (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-8 w-8">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h2 className="mt-4 font-display text-xl font-bold text-slate-900">Check your email</h2>
                <p className="mt-2 text-sm text-slate-600">
                  If an account exists for <strong>{email}</strong>, you&apos;ll receive a password reset link shortly.
                </p>
                <p className="mt-4 text-xs text-slate-500">
                  The link expires in 1 hour. Didn&apos;t receive it? Check your spam folder.
                </p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Link to="/login" className="btn-primary">
                    Back to sign in
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="btn-secondary"
                  >
                    Try another email
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                  Forgot password
                </p>
                <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-900">
                  Reset your password
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  Enter your email and we&apos;ll send you a secure link to set a new password.
                </p>

                <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="reset-email" className="field-label">
                      Email address
                    </label>
                    <input
                      id="reset-email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@yourinstitute.in"
                      className="input-field"
                    />
                  </div>

                  <button type="submit" disabled={submitting} className="btn-primary w-full">
                    {submitting ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>

                <p className="mt-6 text-center text-xs text-slate-500">
                  Remember your password?{' '}
                  <Link to="/login" className="font-semibold text-blue-700 hover:text-blue-800">
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}