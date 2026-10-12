"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

/** Polished empty state with a soft entrance animation. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  compact,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 p-8 text-center",
        !compact && "flex-1"
      )}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-600/15 dark:text-indigo-300">
        <Icon className="h-7 w-7" />
      </span>
      <p className="text-lg font-bold text-slate-700 dark:text-slate-100">
        {title}
      </p>
      {description && (
        <p className="max-w-sm text-sm leading-6 text-slate-400">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-1 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-500"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}
