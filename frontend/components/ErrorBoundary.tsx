"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[200px] p-6">
          <div className="li-card rounded-lg border border-li-border bg-li-surface p-8 max-w-md w-full text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-li-danger/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-li-danger" />
              </div>
            </div>
            <h3 className="text-lg font-display font-semibold text-li-text-primary">
              Something went wrong
            </h3>
            <p className="text-sm text-li-text-muted">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-li-primary text-white hover:bg-li-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
