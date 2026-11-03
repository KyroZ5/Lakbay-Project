import React from 'react';

/**
 * Top-level safety net: a render-time exception anywhere in the tree would otherwise unmount
 * the whole app and leave a white page. Shows a recoverable message instead.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Unhandled render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div role="alert" className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-lg">
          <h1 className="text-2xl font-black text-slate-900">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-600">
            This page hit an unexpected error. Please try again — if it keeps happening, contact our support team.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Reload page
            </button>
            <a href="/" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Go to homepage
            </a>
          </div>
        </div>
      </div>
    );
  }
}
