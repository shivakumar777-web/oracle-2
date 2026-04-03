"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Manthana] Component error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
          <div className="text-4xl opacity-40">◎</div>
          <h3 className="font-ui text-sm tracking-wider text-cream/50 uppercase">
            Something went wrong
          </h3>
          <p className="font-body text-xs italic text-cream/25 max-w-xs">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="pill pill-gold mt-2 text-xs"
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Simpler functional error component for known failure states */
export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center">
      <div className="text-3xl opacity-30">⚠</div>
      <p className="font-body text-xs italic text-cream/30 max-w-xs">
        {message ?? "Unable to connect to the knowledge engine."}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="pill pill-gold text-xs mt-1">
          Retry
        </button>
      )}
    </div>
  );
}
