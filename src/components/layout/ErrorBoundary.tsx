import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * Last line of defence. Data lives in IndexedDB and the active workout in
 * localStorage, so a reload is always safe — nothing is lost.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[forge] render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 p-6 text-center"
      >
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-sm text-fg-2">
          Your workouts are stored safely on this device. Reloading usually fixes this.
        </p>
        <pre className="max-w-full overflow-auto rounded-xl bg-fill p-3 text-left text-xs text-fg-2">
          {this.state.error.message}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-accent-fg active:scale-95"
        >
          Reload Forge
        </button>
      </div>
    );
  }
}
