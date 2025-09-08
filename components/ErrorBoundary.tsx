import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-4xl mx-auto my-8 p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-center">
          <h2 className="text-2xl font-bold text-red-800 dark:text-red-200">Something went wrong.</h2>
          <p className="mt-2 text-red-600 dark:text-red-300">
            The application encountered an unexpected error, which might be due to an unusual response from the AI.
          </p>
          <details className="mt-4 text-left bg-white dark:bg-slate-800 p-2 rounded border border-red-200 dark:border-red-600">
            <summary className="cursor-pointer font-medium text-sm text-red-700 dark:text-red-300">Error Details</summary>
            <pre className="mt-2 text-xs text-red-500 dark:text-red-400 whitespace-pre-wrap">
              {this.state.error?.toString()}
            </pre>
          </details>
          <button
            onClick={this.handleReset}
            className="mt-6 px-6 py-2 text-white bg-red-600 rounded-md font-semibold hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
