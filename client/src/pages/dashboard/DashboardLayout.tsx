import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../lib/auth';
import { ErrorBoundary } from '../../components/ui/ErrorBoundary';
import ThemeToggle from '../../components/ThemeToggle';
import { initials, isAdminRole, roleBadgeClasses, roleLabel } from '../../lib/roles';
import type { UserRole } from '../../lib/types';

function MenuIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function UserIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function GridIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

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

function ClipboardIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 16h4" />
    </svg>
  );
}

function LogoutIcon({ className = 'h-5 w-5' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17l5-5-5-5M20 12H9M12 4H6a2 2 0 00-2 2v12a2 2 0 002 2h6" />
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

function ExternalIcon({ className = 'h-4 w-4' }: { className?: string }): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4" />
    </svg>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: JSX.Element;
  roles: readonly UserRole[];
}

const NAV_ITEMS: readonly NavItem[] = [
  {
    to: '/app/dashboard',
    label: 'Overview',
    icon: <GridIcon />,
    roles: ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'RECEPTIONIST'],
  },
  {
    to: '/app/teacher',
    label: 'Attendance',
    icon: <ClipboardIcon />,
    roles: ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'RECEPTIONIST', 'TEACHER'],
  },
  {
    to: '/app/escalation',
    label: 'Red Alerts',
    icon: <AlertCircleIcon />,
    roles: ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'RECEPTIONIST'],
  },
  {
    to: '/app/admin/leads',
    label: 'Leads',
    icon: <UsersIcon />,
    roles: ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'RECEPTIONIST'],
  },
  {
    to: '/app/admin/students',
    label: 'Students',
    icon: <ClipboardIcon />,
    roles: ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'RECEPTIONIST'],
  },
  {
    to: '/app/admin/analytics',
    label: 'Analytics',
    icon: <CalendarIcon />,
    roles: ['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'RECEPTIONIST'],
  },
];

function navLinkClass(isActive: boolean): string {
  return `flex min-h-touch items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
    isActive
      ? 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
  }`;
}

export default function DashboardLayout(): JSX.Element {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer whenever location changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const isAttendanceView = location.pathname.startsWith('/app/teacher');
  const visibleNav = user
    ? NAV_ITEMS.filter((item) => item.roles.includes(user.role))
    : [];

  function handleLogout(): void {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-150 dark:bg-slate-950 dark:text-slate-100 lg:flex">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="border-b border-slate-200 px-5 py-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-900 font-display text-xs font-extrabold tracking-tight text-white dark:bg-blue-600">
              PDO
            </span>
            <span>
              <span className="block font-display text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                P.D.O Classes
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                Staff workspace
              </span>
            </span>
          </div>
        </div>

        {user ? (
          <div className="mx-4 mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Active tenant
            </p>
            <p className="mt-1 truncate text-xs font-semibold text-slate-900 dark:text-white">
              {user.instituteName}
            </p>
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[10px] font-medium text-green-700 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              RLS enforced · pdo_app
            </p>
          </div>
        ) : null}

        <nav className="mt-5 flex-1 px-3" aria-label="Workspace">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            Workspace
          </p>
          <ul className="space-y-1">
            {visibleNav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => navLinkClass(isActive)}
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-900 font-display text-[11px] font-bold text-white dark:bg-blue-600">
                {initials(user.fullName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-slate-900 dark:text-white">
                  {user.fullName}
                </span>
                <span
                  className={`mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ring-inset ${roleBadgeClasses(
                    user.role,
                  )}`}
                >
                  {roleLabel(user.role)}
                </span>
              </span>
            </div>
          ) : null}

          <div className="mt-3 flex flex-col gap-1">
            <NavLink
              to="/app/profile"
              className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400"
            >
              <UserIcon className="h-4 w-4" />
              Profile
            </NavLink>
            <NavLink
              to="/"
              className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <ExternalIcon />
              Public website
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-700 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              <LogoutIcon className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen w-full flex-col lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-brand-900 font-display text-[10px] font-extrabold text-white dark:bg-blue-600">
                PDO
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold text-slate-900 dark:text-white">
                  {user?.instituteName ?? 'P.D.O Classes'}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {isAttendanceView ? 'Attendance desk' : 'Staff workspace'}
                </p>
              </div>
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Signed in as{' '}
                <span className="font-semibold text-slate-900 dark:text-white">{user?.fullName ?? '—'}</span>
              </span>
            </div>

            {/* Actions: Theme toggle, Avatar, Logout, Mobile Drawer button */}
            <div className="flex items-center gap-2">
              <ThemeToggle />

              {user ? (
                <span
                  className={`hidden rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset sm:inline-flex ${roleBadgeClasses(
                    user.role,
                  )}`}
                >
                  {roleLabel(user.role)}
                </span>
              ) : null}

              <NavLink
                to="/app/profile"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-900 font-display text-[10px] font-bold text-white hover:opacity-90 dark:bg-blue-600 lg:hidden"
                title="Profile"
              >
                {user ? initials(user.fullName) : 'PD'}
              </NavLink>

              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
                aria-label="Toggle navigation menu"
                title="Menu"
              >
                {mobileMenuOpen ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-400 sm:flex"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogoutIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mobile Top Navigation Tabs (Horizontally scrollable, placed at the top for instant access) */}
          {!isAttendanceView ? (
            <nav
              className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-t border-slate-100 bg-slate-50/80 px-3 py-1.5 dark:border-slate-800/80 dark:bg-slate-900/60 lg:hidden"
              aria-label="Workspace tabs"
            >
              {visibleNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex flex-none items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                    }`
                  }
                >
                  <span className="h-3.5 w-3.5 flex-none">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          ) : null}

          {/* Mobile slide-down drawer menu when user clicks the menu toggle button */}
          {mobileMenuOpen && (
            <div className="animate-fade-in border-t border-slate-200 bg-white px-4 py-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 lg:hidden">
              <p className="pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Workspace Sections
              </p>
              <div className="grid grid-cols-2 gap-2">
                {visibleNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold transition ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                      }`
                    }
                  >
                    <span className="h-4 w-4">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                <NavLink
                  to="/app/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 dark:text-slate-300"
                >
                  <UserIcon className="h-4 w-4" />
                  Account Profile
                </NavLink>
                <NavLink
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 rounded-lg py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 dark:text-slate-300"
                >
                  <ExternalIcon className="h-4 w-4" />
                  View Public Website
                </NavLink>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 rounded-lg py-2 text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  <LogoutIcon className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8 pb-10">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>

        <footer className="hidden border-t border-slate-200 bg-white px-6 py-4 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 lg:block">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <p>
              {isAdminRole(user?.role ?? 'TEACHER') ? 'Admin workspace' : 'Staff workspace'} ·{' '}
              P.D.O Classes, Lalpur, Ranchi
            </p>
            <p className="font-mono">T+10 WhatsApp · T+13 Red Alert</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
