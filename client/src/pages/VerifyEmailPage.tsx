import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

import { api } from '../lib/api';
import { ApiError } from '../lib/api';
import { BUSINESS } from '../lib/business';
import { verifyEmailSchema } from '../lib/validation';
import { useApiErrorToast } from '../components/ui';

type Status = 'verifying' | 'success' | 'error' | 'already_verified';

export default function VerifyEmailPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const showApiError = useApiErrorToast();

  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState<string>('');
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    const verify = async (): Promise<void> => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid or missing verification token');
        return;
      }

      const parsed = verifyEmailSchema.safeParse({ token });
      if (!parsed.success) {
        showApiError(parsed.error, 'Invalid verification link');
        setStatus('error');
        setMessage('Invalid or missing verification token');
        return;
      }

      try {
        const result = await api.verifyEmail(token);
        if (result.email) {
          setEmail(result.email);
        }
        if (result.alreadyVerified) {
          setStatus('already_verified');
          setMessage('This email address was already verified. You can sign in now.');
        } else {
          setStatus('success');
          setMessage('Your email has been verified successfully! You can now sign in.');
        }
      } catch (error) {
        if (error instanceof ApiError) {
          setStatus('error');
          setMessage(error.message);
          showApiError(error, 'Verification failed');
        } else {
          setStatus('error');
          setMessage('Could not reach the API. Check that the server is running and try again.');
          showApiError(error, 'Verification failed');
        }
      }
    };

    verify();
  }, [token, showApiError]);

  const handleResend = async (): Promise<void> => {
    if (!email.trim() || !email.includes('@')) return;

    try {
      await api.resendVerification(email.trim());
      showApiError(new Error('Verification email sent! Please check your inbox.'), 'Email sent');
    } catch (error) {
      if (error instanceof ApiError) {
        showApiError(error, 'Failed to resend email');
      } else {
        showApiError(error, 'Could not resend email. Please try again.');
      }
    }
  };

  const getStatusContent = (): JSX.Element => {
    switch (status) {
      case 'verifying':
        return (
          <div className="text-center py-10">
            <div className="mx-auto flex h-12 w-12 animate-spin items-center justify-center rounded-full border-4 border-blue-600 border-t-transparent" />
            <h2 className="mt-4 font-display text-xl font-bold text-slate-900">Verifying your email…</h2>
            <p className="mt-2 text-sm text-slate-600">Please wait while we confirm your account.</p>
          </div>
        );
      case 'success':
        return (
          <div className="text-center py-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-8 w-8">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="mt-4 font-display text-xl font-bold text-slate-900">Email verified!</h2>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            <div className="mt-6">
              <Link to="/login" className="btn-primary">
                Sign in
              </Link>
            </div>
          </div>
        );
      case 'already_verified':
        return (
          <div className="text-center py-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-8 w-8">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="mt-4 font-display text-xl font-bold text-slate-900">Already verified</h2>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            <div className="mt-6">
              <Link to="/login" className="btn-primary">
                Sign in
              </Link>
            </div>
          </div>
        );
      case 'error':
        return (
          <div className="text-center py-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-700">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-8 w-8">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="mt-4 font-display text-xl font-bold text-slate-900">Verification failed</h2>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            <div className="mt-6 space-y-3">
              <Link to="/login" className="btn-primary block">
                Try signing in
              </Link>
              {email ? (
                <button
                  type="button"
                  onClick={handleResend}
                  className="btn-secondary w-full"
                >
                  Resend verification email
                </button>
              ) : (
                <Link to="/register" className="btn-secondary block">
                  Create a new account
                </Link>
              )}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="card p-6 sm:p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-900 font-display text-xs font-extrabold tracking-tight text-white">
              PDO
            </span>
            <span>
              <span className="block font-display text-sm font-bold text-slate-900">{BUSINESS.name}</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Lalpur · Ranchi
              </span>
            </span>
          </Link>
        </div>

        {getStatusContent()}

        <p className="mt-8 text-center text-[11px] text-slate-500">
          Need help?{' '}
          <a href={`mailto:${BUSINESS.email}`} className="font-semibold text-blue-700 hover:text-blue-800 underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}