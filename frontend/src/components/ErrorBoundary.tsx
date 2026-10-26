import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Catches any uncaught render/effect error anywhere below it and shows a
// recoverable screen instead of leaving the whole app blank. Without this,
// React unmounts the entire tree on the first uncaught exception - which is
// exactly what happened with the AR cleanup crash (see ScienceScene) before
// this existed, and would happen again for any future bug of the same
// shape. This is a deliberate last resort, not a substitute for fixing the
// underlying bug.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Uncaught app error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="app-crash-screen">
        <article className="panel-card">
          <p className="eyebrow">Something went wrong</p>
          <h2>The app could not continue</h2>
          <p>Reload the app to try again. Answers you were still typing may need to be entered again.</p>
          <button className="primary-button" onClick={() => window.location.reload()}>Reload App</button>
        </article>
      </div>
    );
  }
}
