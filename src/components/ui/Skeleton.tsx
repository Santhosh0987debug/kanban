"use client";

import { cn } from "@/lib/cn";

/** Base shimmer block. The sweeping highlight comes from `.skeleton-shimmer` in globals.css. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "skeleton-shimmer rounded-md bg-slate-200 dark:bg-white/10",
        className
      )}
    />
  );
}

/** Sidebar board-list placeholder rows. */
export function SidebarSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 py-2 pr-4" aria-label="Loading boards">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-10 rounded-r-full rounded-l-none",
            i === 0 && "w-11/12",
            i === 1 && "w-4/5",
            i === 2 && "w-3/5",
            i > 2 && "w-2/3"
          )}
        />
      ))}
    </div>
  );
}

export function TaskCardSkeleton() {
  return (
    <div className="rounded-lg bg-white px-4 py-3 shadow-sm dark:bg-[#2b2c37]">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </div>
  );
}

/** Board detail placeholder: 3 columns with header + stacked cards. */
export function BoardSkeleton() {
  return (
    <div
      className="flex flex-1 gap-6 overflow-hidden p-4 md:p-6"
      aria-label="Loading board"
    >
      {[0, 1, 2].map((col) => (
        <div key={col} className="flex w-[280px] shrink-0 flex-col">
          <div className="flex items-center gap-2 px-1 pb-4">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex flex-col gap-4">
            <TaskCardSkeleton />
            <TaskCardSkeleton />
            {col === 0 && <TaskCardSkeleton />}
          </div>
        </div>
      ))}
    </div>
  );
}
