import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => string;
  hideToast: (id: string) => void;
  success: (title: string, message?: string, options?: Partial<Toast>) => string;
  error: (title: string, message?: string, options?: Partial<Toast>) => string;
  warning: (title: string, message?: string, options?: Partial<Toast>) => string;
  info: (title: string, message?: string, options?: Partial<Toast>) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_ICONS: Record<ToastType, JSX.Element> = {
  success: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 9.586V6z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  ),
};

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const TOAST_ICON_COLORS: Record<ToastType, string> = {
  success: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-blue-600',
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }): JSX.Element {
  const style = TOAST_STYLES[toast.type];
  const iconColor = TOAST_ICON_COLORS[toast.type];

  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => onClose(), toast.duration ?? 5000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`animate-toast-in flex items-start gap-3 rounded-xl border p-4 shadow-lg ${style}`}
    >
      <span className={`flex h-5 w-5 flex-none items-center justify-center ${iconColor}`}>
        {TOAST_ICONS[toast.type]}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{toast.title}</p>
        {toast.message && <p className="mt-0.5 text-sm opacity-90">{toast.message}</p>}
        {toast.action && (
          <button
            onClick={() => { toast.action!.onClick(); onClose(); }}
            className="mt-2 text-xs font-semibold underline hover:no-underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        onClick={onClose}
        className="flex h-5 w-5 flex-none items-center justify-center rounded-lg opacity-50 hover:opacity-100 transition"
        aria-label="Dismiss"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const helpers = useMemo<ToastContextValue>(
    () => ({
      toasts,
      showToast,
      hideToast,
      success: (title, message, options) => showToast({ type: 'success', title, message, ...options }),
      error: (title, message, options) => showToast({ type: 'error', title, message, ...options }),
      warning: (title, message, options) => showToast({ type: 'warning', title, message, ...options }),
      info: (title, message, options) => showToast({ type: 'info', title, message, ...options }),
    }),
    [toasts, showToast, hideToast],
  );

  return (
    <ToastContext.Provider value={helpers}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 sm:max-w-sm" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => hideToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast() must be used within a ToastProvider');
  }
  return context;
}

/**
 * Convenience hook for showing API errors as toasts
 */
export function useApiErrorToast(): (error: unknown, fallbackTitle?: string) => void {
  const { error: showError } = useToast();

  return useCallback((error: unknown, fallbackTitle = 'Something went wrong') => {
    if (error instanceof Response) {
      // Can't easily get message from Response here, use fallback
      showError(fallbackTitle);
      return;
    }
    if (error && typeof error === 'object' && 'status' in error && 'message' in error) {
      const apiError = error as { status: number; code: string; message: string; details?: Record<string, string> };
      let message = apiError.message;
      if (apiError.details) {
        const firstDetail = Object.values(apiError.details)[0];
        if (firstDetail) message = firstDetail;
      }
      showError(fallbackTitle, message);
      return;
    }
    if (error instanceof Error) {
      showError(fallbackTitle, error.message);
      return;
    }
    showError(fallbackTitle, String(error));
  }, [showError]);
}