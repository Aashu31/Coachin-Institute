import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../lib/auth';
import { BUSINESS } from '../lib/business';

export default function NotFoundPage(): JSX.Element {
  const { user, status } = useAuth();
  const location = useLocation();

  const isAuthenticated = status === 'authenticated' && user !== null;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="card p-8 sm:p-12 max-w-md w-full text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-brand-900 font-display text-xs font-extrabold tracking-tight text-white">
          PDO
        </div>
        <p className="mt-6 font-mono text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
          404 · page not found
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          That classroom does not exist.
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500 mx-auto">
          The page you&apos;re looking for may have moved, or the link was typed incorrectly.
          {location.pathname !== '/' && <span className="block mt-1"><code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">{location.pathname}</code></span>}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {isAuthenticated ? (
            <Link to="/app/dashboard" className="btn-primary">
              Go to Dashboard
            </Link>
          ) : (
            <Link to="/" className="btn-primary">
              Back to Home
            </Link>
          )}
          <Link to="/" className="btn-secondary">
            Public Website
          </Link>
        </div>
        <div className="mt-8 text-xs text-slate-500">
          <p>P.D.O Classes · P&T Colony, Lalpur, Ranchi</p>
          <p className="mt-1"><a href={`mailto:${BUSINESS.email}`} className="text-blue-700 hover:text-blue-800 underline">Contact Support</a></p>
        </div>
      </div>
    </div>
  );
}