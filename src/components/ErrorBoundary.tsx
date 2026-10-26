import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Terminal-style crash screen — catches any runtime error honestly.
 *
 * The copy is English on purpose: this screen renders when something already
 * broke, and it must not depend on the language provider, the storage or any
 * component that could be the thing that crashed.
 *
 * It lives in its own file so the fallback can be tested by rendering a child
 * that throws; a class component inside App.tsx could not be reached.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('gh-scope crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg p-4">
          <div className="bg-grid" aria-hidden="true" />
          <div className="glow glow-a" aria-hidden="true" />
          <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-coral/40 bg-panel shadow-soft">
            <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-coral/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-mint/70" />
              <span className="ml-2 font-mono text-[11px] text-coral">gh-scope — kernel panic</span>
            </div>
            <div className="p-6 font-mono text-sm leading-relaxed">
              <p className="text-coral">✗ something crashed while rendering</p>
              <p className="mt-3 break-all text-xs text-mut">{this.state.error.message}</p>
              <p className="mt-4 text-xs text-mut/70">This is a client-side bug, not your data. Reloading usually fixes it.</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-5 rounded-lg border border-amber/50 bg-amber/10 px-4 py-2 text-xs font-semibold text-amber transition-colors hover:bg-amber/20"
              >
                reboot ↻
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
