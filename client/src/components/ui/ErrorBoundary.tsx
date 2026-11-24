import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Log to console for debugging
    console.error('ErrorBoundary caught an error:', _error, _errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
          <div className="rounded-xl bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-600 mb-6">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="btn-primary min-h-touch"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function withErrorBoundary(Component: React.ComponentType, fallback?: ReactNode): React.ComponentType {
  return function ErrorBoundaryWrapper(props: Record<string, unknown>) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...(props as Record<string, never>)} />
      </ErrorBoundary>
    );
  };
}
