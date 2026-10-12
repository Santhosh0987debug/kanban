"use client";

import { AnimatePresence, motion } from "framer-motion";
import { History, X } from "lucide-react";
import { initials, timeAgo } from "@/lib/types";
import { useBoardStore } from "@/store/useBoardStore";
import { Skeleton } from "@/components/ui/Skeleton";

/** Slide-over panel with the board's live audit trail. */
export function ActivityLogDrawer() {
  const isOpen = useBoardStore((s) => s.isLogDrawerOpen);
  const closeLogDrawer = useBoardStore((s) => s.closeLogDrawer);
  const logs = useBoardStore((s) => s.activityLogs);
  const loadingLogs = useBoardStore((s) => s.loadingLogs);
  const board = useBoardStore((s) => s.board);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-label="Activity log">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-black/50"
            onClick={closeLogDrawer}
          />
          <motion.aside
            initial={{ x: 360 }}
            animate={{ x: 0 }}
            exit={{ x: 360 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-white shadow-2xl dark:bg-[#2b2c37]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Activity
                </h2>
                {board && (
                  <p className="truncate text-xs text-slate-400">{board.name}</p>
                )}
              </div>
              <button
                onClick={closeLogDrawer}
                aria-label="Close activity log"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loadingLogs && logs.length === 0 ? (
                <div className="space-y-3" aria-label="Loading activity">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/10">
                    <History className="h-6 w-6" />
                  </span>
                  <p className="text-sm font-bold text-slate-500 dark:text-slate-300">
                    No activity yet
                  </p>
                  <p className="max-w-[220px] text-xs leading-5 text-slate-400">
                    Task creates, moves, and edits will show up here in real
                    time.
                  </p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {logs.map((log) => (
                    <motion.li
                      key={log._id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <span
                        title={log.actorName}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white"
                      >
                        {initials(log.actorName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-700 dark:text-slate-200">
                          <span className="font-bold">{log.actorName}</span>{" "}
                          {log.action}
                        </span>
                        <span className="text-xs text-slate-400">
                          {timeAgo(log.createdAt)}
                        </span>
                      </span>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
