import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for debugging; non-fatal
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <span className="text-5xl">😅</span>
        <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          A small hiccup. Try again, or head home.
        </p>
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => {
              this.reset();
              window.location.reload();
            }}
            className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
          >
            Try again
          </button>
          <button
            onClick={() => {
              this.reset();
              window.location.href = '/';
            }}
            className="rounded-full bg-muted px-5 py-2 text-sm font-bold text-foreground"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
