"use client";

import { Component, type ReactNode } from "react";
import { motion } from "framer-motion";
import { TriangleAlert } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/** Inline error fallback with retry, used for failed network loads. */
export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this content. Check your connection and try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      role="alert"
      className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-500 dark:bg-red-500/15">
        <TriangleAlert className="h-7 w-7" />
      </span>
      <p className="text-lg font-bold text-slate-700 dark:text-slate-100">
        {title}
      </p>
      <p className="max-w-sm text-sm leading-6 text-slate-400">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-500"
        >
          Try again
        </button>
      )}
    </motion.div>
  );
}

interface BoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface BoundaryState {
  hasError: boolean;
}

/**
 * Catches render crashes below it (e.g. malformed realtime payloads)
 * so one bad update can't blank the whole app.
 */
export class AppErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("AppErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <ErrorState
            title="This view crashed"
            message="An unexpected error occurred while rendering. Reload the board to recover."
            onRetry={() => this.setState({ hasError: false })}
          />
        )
      );
    }
    return this.props.children;
  }
}
