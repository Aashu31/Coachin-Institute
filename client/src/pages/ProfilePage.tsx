import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { homePathForRole } from '../lib/roles';
import { updateProfileSchema, changePasswordSchema, deleteAccountSchema } from '../lib/validation';
import { useApiErrorToast } from '../components/ui';

type Tab = 'profile' | 'password' | 'danger';

export default function ProfilePage(): JSX.Element {
  const { user, updateProfile, changePassword, deleteAccount, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const showApiError = useApiErrorToast();

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [saving, setSaving] = useState(false);

  // Profile form state
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Danger zone state
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSaving(true);

    const parsed = updateProfileSchema.safeParse({ fullName: fullName.trim(), phone: phone.trim() });
    if (!parsed.success) {
      showApiError(parsed.error, 'Validation failed');
      setSaving(false);
      return;
    }

    try {
      await updateProfile({ fullName: parsed.data.fullName, phone: parsed.data.phone });
      await refreshUser();
      showApiError(new Error('Profile updated successfully'), 'Success');
    } catch (err) {
      if (err instanceof ApiError) {
        showApiError(err, 'Failed to update profile');
      } else {
        showApiError(err, 'Failed to update profile. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword: confirmNewPassword });
    if (!parsed.success) {
      showApiError(parsed.error, 'Validation failed');
      return;
    }

    setSaving(true);

    try {
      await changePassword(parsed.data.currentPassword, parsed.data.newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      showApiError(new Error('Password changed successfully. You will be logged out of other sessions.'), 'Success');
    } catch (err) {
      if (err instanceof ApiError) {
        showApiError(err, 'Failed to change password');
      } else {
        showApiError(err, 'Failed to change password. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const parsed = deleteAccountSchema.safeParse({ password: deletePassword, confirmation: deleteConfirmation });
    if (!parsed.success) {
      showApiError(parsed.error, 'Validation failed');
      return;
    }

    setDeleting(true);

    try {
      await deleteAccount(parsed.data.password, parsed.data.confirmation);
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        showApiError(err, 'Failed to delete account');
      } else {
        showApiError(err, 'Failed to delete account. Please try again.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const initials = user?.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
    {
      id: 'profile',
      label: 'Profile',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7s-8-3.134-8-7A8 8 0 1118 10zM2 10a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 10z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      id: 'password',
      label: 'Password',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
        </svg>
      ),
    },
    {
      id: 'danger',
      label: 'Danger Zone',
      icon: (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-12">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to={homePathForRole(user?.role || 'TEACHER')} className="text-sm font-semibold text-blue-700 hover:text-blue-800 mb-2 inline-block">
              ← Back to dashboard
            </Link>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Account Settings</h1>
            <p className="mt-1 text-sm text-slate-600">Manage your profile, password, and account preferences.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-brand-900 flex items-center justify-center text-white font-bold text-lg">
              {user?.avatarInitials || initials}
            </div>
            <div className="text-right hidden sm:block">
              <p className="font-semibold text-slate-900">{user?.fullName}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl hover:bg-red-100 hover:text-red-700 transition"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="M9 19H3a1 1 0 01-1-1V4a1 1 0 011-1h2V1a1 1 0 011 1v2h2a1 1 0 011 1v6a1 1 0 01-1 1H9v2a1 1 0 01-1 1zM6 4H3v2h3V4zm0 12H3v2h3v-2zm10-11v6h-2V5h2zm-1 8a1 1 0 102 0V5a1 1 0 10-2 0v8z" clipRule="evenodd" />
              </svg>
              Sign out
            </button>
          </div>
        </div>

        {/* Tab navigation */}
        <nav className="mb-6 border-b border-slate-200" aria-label="Account settings">
          <ul className="flex gap-8 overflow-x-auto">
            {tabs.map((tab) => (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                  }}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSubmit} className="card p-6 space-y-6" noValidate>
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">Profile Information</h2>
              <p className="mt-1 text-sm text-slate-600">Update your personal information. Changes are visible to your institute colleagues.</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="profile-fullName" className="field-label">
                  Full name
                </label>
                <input
                  id="profile-fullName"
                  name="fullName"
                  type="text"
                  required
                  maxLength={100}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label htmlFor="profile-phone" className="field-label">
                  Mobile number
                </label>
                <input
                  id="profile-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  maxLength={20}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="input-field"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div className="text-sm text-slate-600">
                <p className="font-medium">Email (cannot be changed)</p>
                <p>{user?.email}</p>
              </div>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        )}

        {/* Password Tab */}
        {activeTab === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="card p-6 space-y-6" noValidate>
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">Change Password</h2>
              <p className="mt-1 text-sm text-slate-600">Your current password is required to set a new one.</p>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="currentPassword" className="field-label">
                  Current password
                </label>
                <div className="relative">
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((c) => !c)}
                    className="absolute inset-y-0 right-0 flex w-16 items-center justify-center rounded-r-xl text-xs font-semibold text-slate-500 transition hover:text-slate-900"
                    aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                  >
                    {showCurrentPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="newPassword" className="field-label">
                  New password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((c) => !c)}
                    className="absolute inset-y-0 right-0 flex w-16 items-center justify-center rounded-r-xl text-xs font-semibold text-slate-500 transition hover:text-slate-900"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-500">At least 8 characters.</p>
              </div>

              <div>
                <label htmlFor="confirmNewPassword" className="field-label">
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    id="confirmNewPassword"
                    name="confirmNewPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-field pr-20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((c) => !c)}
                    className="absolute inset-y-0 right-0 flex w-16 items-center justify-center rounded-r-xl text-xs font-semibold text-slate-500 transition hover:text-slate-900"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Updating…' : 'Update password'}
              </button>
            </div>
          </form>
        )}

        {/* Danger Zone Tab */}
        {activeTab === 'danger' && (
          <div className="card p-6 space-y-8 border-red-100">
            <div>
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-red-700">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Danger Zone
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Irreversible actions. Please read carefully before proceeding.
              </p>
            </div>

            <div className="border-t border-red-100 pt-6">
              <h3 className="font-semibold text-slate-900">Delete Account</h3>
              <p className="mt-2 text-sm text-slate-600">
                Permanently delete your account and all associated data. This action cannot be undone.
                Per DPDP Act compliance, your personal data will be anonymized and your account soft-deleted.
                If you are the sole institute administrator, the entire institute will be deactivated.
              </p>

              <form onSubmit={handleDeleteAccount} className="mt-6 space-y-5" noValidate>
                <div>
                  <label htmlFor="delete-confirmation" className="field-label">
                    Type <span className="font-mono text-red-600">DELETE</span> to confirm
                  </label>
                  <input
                    id="delete-confirmation"
                    name="confirmation"
                    type="text"
                    required
                    maxLength={6}
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder="DELETE"
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="delete-password" className="field-label">
                    Current password
                  </label>
                  <div className="relative">
                    <input
                      id="delete-password"
                      name="password"
                      type={showDeletePassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      minLength={8}
                      maxLength={128}
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="••••••••"
                      className="input-field pr-20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowDeletePassword((c) => !c)}
                      className="absolute inset-y-0 right-0 flex w-16 items-center justify-center rounded-r-xl text-xs font-semibold text-slate-500 transition hover:text-slate-900"
                      aria-label={showDeletePassword ? 'Hide password' : 'Show password'}
                    >
                      {showDeletePassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={deleting}
                  className="w-full btn-primary bg-red-600 hover:bg-red-700 border-red-600"
                >
                  {deleting ? 'Deleting account…' : 'Delete my account permanently'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}