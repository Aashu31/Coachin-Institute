import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { useAuth } from './lib/auth';
import { homePathForRole } from './lib/roles';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import OverviewPage from './pages/dashboard/OverviewPage';
import TeacherAttendancePage from './pages/dashboard/TeacherAttendancePage';
import EscalationDashboard from './pages/dashboard/EscalationDashboard';
import LeadsManager from './pages/dashboard/LeadsManager';
import StudentsBatchesManager from './pages/dashboard/StudentsBatchesManager';
import AttendanceAnalytics from './pages/dashboard/AttendanceAnalytics';

function FullScreenLoader(): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-900 font-display text-xs font-extrabold tracking-tight text-white">
        PDO
      </div>
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
        />
        Verifying your session…
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: JSX.Element }): JSX.Element {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <FullScreenLoader />;
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return children;
}

function RoleHome(): JSX.Element {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={homePathForRole(user.role)} replace />;
}

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<RoleHome />} />
        <Route path="dashboard" element={<OverviewPage />} />
        <Route path="teacher" element={<TeacherAttendancePage />} />
        <Route path="escalation" element={<EscalationDashboard />} />
        <Route path="admin/leads" element={<LeadsManager />} />
        <Route path="admin/students" element={<StudentsBatchesManager />} />
        <Route path="admin/analytics" element={<AttendanceAnalytics />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
