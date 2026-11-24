import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BUSINESS } from '../lib/business';
import { homePathForRole, roleLabel } from '../lib/roles';
import { loginSchema } from '../lib/validation';
import { useApiErrorToast } from '../components/ui';

const DEMO_ACCOUNTS = [
  { email: 'admin@pdoclasses.in', role: 'INSTITUTE_ADMIN' as const, name: 'Prakash Dev Ojha' },
  { email: 'reception@pdoclasses.in', role: 'RECEPTIONIST' as const, name: 'Neha Kumari' },
  { email: 'ananya.sinha@pdoclasses.in', role: 'TEACHER' as const, name: 'Ananya Sinha · CAT' },
  { email: 'rakesh.verma@pdoclasses.in', role: 'TEACHER' as const, name: 'Rakesh Verma · PCM' },
];

export default function LoginPage(): JSX.Element {
  const { user, status, login } = useAuth();
  const navigate = useNavigate();
  const showApiError = useApiErrorToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'authenticated' && user) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);

    const parsed = loginSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      showApiError(parsed.error, 'Validation failed');
      setSubmitting(false);
      return;
    }

    try {
      const signedIn = await login(parsed.data.email, parsed.data.password);
      navigate(homePathForRole(signedIn.role), { replace: true });
    } catch (submitError) {
      if (submitError instanceof ApiError) {
        showApiError(submitError, submitError.status === 401 ? 'Sign in failed' : 'Sign in failed');
      } else {
        showApiError(submitError, 'Could not reach the API. Check that the server is running and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-amber-300 ring-1 ring-inset ring-white/15">
            ★ {BUSINESS.googleRating} · {BUSINESS.googleReviews} Google reviews
          </span>
          <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-white">
            The staff desk behind every safe classroom.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            One login for the owner, front desk and faculty. Teachers get a 15-second mobile roll
            call; admins and reception see today’s batches, attendance status and enrolled students.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {[
              'Role-aware dashboards for admin, front desk and teachers',
              'Every query scoped by PostgreSQL Row Level Security',
              'Attendance locked once submitted — no silent edits',
              'Parent contact data never reaches the browser',
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
            P.D.O Classes · P&amp;T Colony
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
            <Link to="/" className="text-xs font-semibold text-blue-700 hover:text-blue-800">
              Back to site
            </Link>
          </div>

          <div className="card p-6 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Staff portal
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-900">
              Sign in to P.D.O Classes
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Use the institute email issued by the admin.
            </p>

            <form onSubmit={(event) => void handleSubmit(event)} className="mt-6 space-y-4">
              <div>
                <label htmlFor="login-email" className="field-label">
                  Email address
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@pdoclasses.in"
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="field-label">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
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

              <button type="submit" disabled={submitting} className="btn-primary w-full">
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <Link to="/forgot-password" className="font-semibold text-blue-700 hover:text-blue-800">
                Forgot password?
              </Link>
              <Link to="/register" className="font-semibold text-blue-700 hover:text-blue-800">
                Create new institute
              </Link>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                Seeded demo accounts
              </p>
              <div className="mt-2.5 grid gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                    }}
                    className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-transparent bg-white px-3 py-2 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-blue-300"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-900">
                        {account.name}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-slate-500">
                        {account.email}
                      </span>
                    </span>
                    <span className="flex-none rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                      {roleLabel(account.role)}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
                Password is the value of{' '}
                <span className="font-mono text-slate-700">SEED_DEFAULT_PASSWORD</span> in{' '}
                <span className="font-mono text-slate-700">server/.env</span>. It is never bundled
                into the browser.
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500">
            Prospective student?{' '}
            <a href="/#demo" className="font-semibold text-blue-700 hover:text-blue-800">
              Book a free demo class
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
