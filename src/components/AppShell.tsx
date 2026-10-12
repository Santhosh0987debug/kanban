"use client";

import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Toaster } from "sonner";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { useBoardRoom } from "@/lib/socket-client";
import { useBoardStore } from "@/store/useBoardStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { BoardView } from "@/components/board/BoardView";
import { BoardModal } from "@/components/modals/BoardModal";
import { TaskModal } from "@/components/modals/TaskModal";
import { ViewTaskModal } from "@/components/modals/ViewTaskModal";
import { ActivityLogDrawer } from "@/components/board/ActivityLogDrawer";
import { AppErrorBoundary } from "@/components/ui/ErrorBoundary";

export function AppShell() {
  const activeBoardId = useBoardStore((s) => s.activeBoardId);
  const user = useBoardStore((s) => s.user);
  const isSidebarOpen = useBoardStore((s) => s.isSidebarOpen);
  const isDarkTheme = useBoardStore((s) => s.isDarkTheme);
  const error = useBoardStore((s) => s.error);
  const boardModalOpen = useBoardStore((s) => s.boardModal.open);
  const taskModalOpen = useBoardStore((s) => s.taskModal.open);
  const viewTaskId = useBoardStore((s) => s.viewTaskId);

  useEffect(() => {
    const store = useBoardStore.getState();
    store.applyStoredTheme();
    void store.fetchBoards();
    store.subscribeRealtime();
    return () => store.unsubscribeRealtime();
  }, []);

  // Join the active board's Socket.io room for live updates + presence.
  useBoardRoom(activeBoardId, user);

  const handleRetry = () => {
    const store = useBoardStore.getState();
    if (activeBoardId) void store.fetchBoardDetail(activeBoardId);
    else void store.fetchBoards();
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f7fd] text-slate-900 dark:bg-[#20212c] dark:text-white">
      <Toaster
        position="bottom-right"
        theme={isDarkTheme ? "dark" : "light"}
        richColors
        closeButton
        toastOptions={{
          style: { fontWeight: 600 },
        }}
      />
      <Sidebar />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[margin] duration-200",
          isSidebarOpen && "md:ml-[260px]"
        )}
      >
        <Header />
        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 md:px-6"
          >
            <TriangleAlert className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{error}</span>
            <button
              onClick={handleRetry}
              className="shrink-0 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white hover:bg-red-600"
            >
              Retry
            </button>
          </div>
        )}
        <main className="flex min-h-0 flex-1 flex-col">
          <AppErrorBoundary key={activeBoardId ?? "no-board"}>
            <BoardView />
          </AppErrorBoundary>
        </main>
      </div>

      <AnimatePresence>
        {boardModalOpen && <BoardModal key="board-modal" />}
        {taskModalOpen && <TaskModal key="task-modal" />}
        {viewTaskId && <ViewTaskModal key="view-task" />}
      </AnimatePresence>
      <ActivityLogDrawer />
    </div>
  );
}
