import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  ApiError,
  api,
  clearStoredSession,
  getAccessToken,
  getStoredUser,
  getTokenExpiry,
  isAccessTokenValid,
  storeSession,
  storeUser,
} from './api';
import type { AuthUser } from './types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  verifyEmail: (token: string) => Promise<{ alreadyVerified: boolean }>;
  resendVerification: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  registerInstitute: (data: {
    instituteName: string;
    instituteSlug: string;
    institutePhone: string;
    instituteEmail: string;
    instituteAddress: string;
    instituteCity: string;
    adminFullName: string;
    adminEmail: string;
    adminPhone: string;
    adminPassword: string;
    confirmPassword: string;
  }) => Promise<{ instituteId: string; userId: string }>;
  updateProfile: (data: { fullName?: string; phone?: string; avatarInitials?: string }) => Promise<AuthUser>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (password: string, confirmation: string) => Promise<{ wasSoleAdmin: boolean; instituteDeactivated: boolean }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [status, setStatus] = useState<AuthStatus>('loading');
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRefreshTimer = useCallback((): void => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const scheduleProactiveRefresh = useCallback((): void => {
    clearRefreshTimer();
    const token = getAccessToken();
    if (!token) return;

    // Proactively refresh at 80% of TTL to avoid 401s mid-session.
    // api.isAccessTokenValid handles decoding + expiry check internally.
    if (!isAccessTokenValid()) return;

    const expiry = getTokenExpiry(token);
    if (!expiry) return;
    const ttlMs = expiry * 1000 - Date.now();
    const refreshAt = ttlMs * 0.8;
    if (refreshAt > 0) {
      refreshTimer.current = setTimeout(() => {
        void api.refreshAccessToken?.().catch(() => {
          // Silent: proactive refresh may fail, next request will handle it
        });
      }, Math.max(refreshAt, 1000));
    }
  }, [clearRefreshTimer]);

  const logout = useCallback(async (): Promise<void> => {
    clearRefreshTimer();
    try {
      await api.logout();
    } catch {
      // Ignore logout errors - we clear local state regardless
    }
    clearStoredSession();
    setUser(null);
    setStatus('anonymous');
  }, [clearRefreshTimer]);

  const refreshUser = useCallback(async (): Promise<void> => {
    const token = getAccessToken();
    if (!token) {
      setStatus('anonymous');
      return;
    }

    // If token is expired, try refresh first before calling /me
    if (!isAccessTokenValid()) {
      try {
        await api.refreshAccessToken();
      } catch {
        logout();
        return;
      }
    }

    try {
      const nextUser = await api.me();
      storeUser(nextUser);
      setUser(nextUser);
      setStatus('authenticated');
      scheduleProactiveRefresh();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        logout();
        return;
      }

      // Network hiccup: keep the cached identity
      setStatus((current) => (current === 'loading' ? 'anonymous' : current));
    }
  }, [logout, scheduleProactiveRefresh]);

  useEffect(() => {
    if (!getAccessToken()) {
      setStatus('anonymous');
      return;
    }

    const stored = getStoredUser();

    if (stored) {
      setUser(stored);
    }

    // Only mark authenticated after refreshUser confirms the token works.
    // If the token is expired, refreshUser will try refresh first (silently).
    void refreshUser();
  }, [refreshUser]);

  const handleExpired = useCallback((): void => {
    logout();
  }, [logout]);

  const handleRefreshed = useCallback((event: Event): void => {
    const detail = (event as CustomEvent<AuthUser>).detail;
    if (detail) {
      setUser(detail);
      setStatus('authenticated');
      scheduleProactiveRefresh();
    }
  }, [scheduleProactiveRefresh]);

  useEffect(() => {
    window.addEventListener('pdo:session-expired', handleExpired);
    window.addEventListener('pdo:session-refreshed', handleRefreshed);

    return () => {
      clearRefreshTimer();
      window.removeEventListener('pdo:session-expired', handleExpired);
      window.removeEventListener('pdo:session-refreshed', handleRefreshed);
    };
  }, [handleExpired, handleRefreshed, clearRefreshTimer]);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const result = await api.login(email, password);
    storeSession(result);
    setUser(result.user);
    setStatus('authenticated');
    scheduleProactiveRefresh();
    return result.user;
  }, [scheduleProactiveRefresh]);

  const verifyEmail = useCallback(async (token: string) => {
    const result = await api.verifyEmail(token);
    return { alreadyVerified: result.alreadyVerified };
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    await api.resendVerification(email);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    await api.forgotPassword(email);
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    await api.resetPassword(token, password);
  }, []);

  const registerInstitute = useCallback(async (data: {
    instituteName: string;
    instituteSlug: string;
    institutePhone: string;
    instituteEmail: string;
    instituteAddress: string;
    instituteCity: string;
    adminFullName: string;
    adminEmail: string;
    adminPhone: string;
    adminPassword: string;
    confirmPassword: string;
  }) => {
    const result = await api.registerInstitute(data);
    return { instituteId: result.instituteId, userId: result.userId };
  }, []);

  const updateProfile = useCallback(async (data: { fullName?: string; phone?: string; avatarInitials?: string }) => {
    const result = await api.updateProfile(data);
    storeUser(result.user);
    setUser(result.user);
    return result.user;
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await api.changePassword(currentPassword, newPassword);
  }, []);

  const deleteAccount = useCallback(async (password: string, confirmation: string) => {
    const result = await api.deleteAccount(password, confirmation);
    clearStoredSession();
    setUser(null);
    setStatus('anonymous');
    return result;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      login,
      logout,
      refreshUser,
      verifyEmail,
      resendVerification,
      forgotPassword,
      resetPassword,
      registerInstitute,
      updateProfile,
      changePassword,
      deleteAccount,
    }),
    [
      user,
      status,
      login,
      logout,
      refreshUser,
      verifyEmail,
      resendVerification,
      forgotPassword,
      resetPassword,
      registerInstitute,
      updateProfile,
      changePassword,
      deleteAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth() must be used inside <AuthProvider>.');
  }

  return context;
}
