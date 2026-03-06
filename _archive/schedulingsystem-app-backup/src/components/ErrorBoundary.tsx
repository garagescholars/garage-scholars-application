import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md bg-white rounded-2xl shadow-sm border border-rose-200 p-6">
            <h1 className="text-2xl font-bold text-rose-700 mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-600 mb-4">
              The application encountered an unexpected error. Please refresh the page to try again.
            </p>
            {this.state.error && (
              <details className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 mb-4">
                <summary className="cursor-pointer font-semibold">Error details</summary>
                <pre className="mt-2 whitespace-pre-wrap">{this.state.error.toString()}</pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
