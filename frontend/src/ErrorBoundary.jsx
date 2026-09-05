import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="crash-screen">
          <div className="crash-card">
            <div className="crash-icon">
              <span className="material-symbols-outlined">warning</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Something broke in the UI</h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-2">
              SplitVerdict caught the error so the page does not go white. Reload to continue.
            </p>
            {this.state.error && (
              <pre className="crash-detail">{String(this.state.error)}</pre>
            )}
            <button
              className="inline-flex items-center justify-center gap-space-xs px-space-xl py-space-md rounded-xl bg-primary-container text-on-primary-container font-headline-sm font-bold"
              onClick={this.handleReset}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
