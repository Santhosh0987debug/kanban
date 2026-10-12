"use client";

import { AnimatePresence, motion } from "framer-motion";
import { EyeOff, LayoutGrid, Moon, Plus, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { useBoardStore } from "@/store/useBoardStore";
import { SidebarSkeleton } from "@/components/ui/Skeleton";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const boards = useBoardStore((s) => s.boards);
  const loadingBoards = useBoardStore((s) => s.loadingBoards);
  const activeBoardId = useBoardStore((s) => s.activeBoardId);
  const setActiveBoard = useBoardStore((s) => s.setActiveBoard);
  const openBoardModal = useBoardStore((s) => s.openBoardModal);
  const isDarkTheme = useBoardStore((s) => s.isDarkTheme);
  const toggleTheme = useBoardStore((s) => s.toggleTheme);
  const toggleSidebar = useBoardStore((s) => s.toggleSidebar);

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#2b2c37]">
      <div className="px-6 pb-2 pt-6">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          All boards ({boards.length})
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 pr-4" aria-label="Boards">
        {loadingBoards && boards.length === 0 ? (
          <SidebarSkeleton />
        ) : (
          boards.map((board) => {
            const active = board._id === activeBoardId;
            return (
              <button
                key={board._id}
                onClick={() => {
                  void setActiveBoard(board._id);
                  onNavigate?.();
                }}
                className={cn(
                  "mb-1 flex w-full items-center gap-3 rounded-r-full px-6 py-2.5 text-[15px] font-bold transition-colors",
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-slate-500 hover:bg-indigo-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                )}
              >
                <LayoutGrid className="h-4 w-4 shrink-0" />
                <span className="truncate">{board.name}</span>
              </button>
            );
          })
        )}

        <button
          onClick={() => {
            openBoardModal("create");
            onNavigate?.();
          }}
          className="flex w-full items-center gap-3 rounded-r-full px-6 py-2.5 text-[15px] font-bold text-indigo-600 hover:bg-indigo-100 dark:hover:bg-white/5"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>+ Create New Board</span>
        </button>
      </nav>

      <div className="space-y-4 p-4">
        <div className="flex items-center justify-center gap-4 rounded-lg bg-slate-100 py-3 dark:bg-[#20212c]">
          <Sun className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <button
            role="switch"
            aria-checked={isDarkTheme}
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
            className="relative h-5 w-10 rounded-full bg-indigo-600 p-0.5 transition-colors"
          >
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 500, damping: 32 }}
              className={cn(
                "block h-4 w-4 rounded-full bg-white",
                isDarkTheme ? "ml-auto" : "ml-0"
              )}
            />
          </button>
          <Moon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        </div>

        <button
          onClick={toggleSidebar}
          className="hidden items-center gap-3 px-2 py-1 text-[15px] font-bold text-slate-500 hover:text-indigo-600 md:flex dark:text-slate-400"
        >
          <EyeOff className="h-4 w-4" />
          Hide Sidebar
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const isSidebarOpen = useBoardStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useBoardStore((s) => s.setSidebarOpen);

  return (
    <>
      {/* Desktop: fixed collapsible sidebar with spring slide */}
      <motion.aside
        initial={false}
        animate={{ x: isSidebarOpen ? 0 : -260 }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-slate-200 md:block dark:border-white/5"
      >
        <div className="flex h-20 items-center bg-white px-6 dark:bg-[#2b2c37]">
          <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            kanban
          </span>
        </div>
        <div className="h-[calc(100%-5rem)]">
          <SidebarContent />
        </div>
      </motion.aside>

      {/* Mobile: popup drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-black/50"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="absolute inset-y-0 left-0 w-[260px] overflow-hidden rounded-r-2xl"
            >
              <SidebarContent onNavigate={() => setSidebarOpen(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
