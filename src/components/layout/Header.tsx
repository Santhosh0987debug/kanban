"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, History, Menu, MoreVertical, Plus } from "lucide-react";
import { initials } from "@/lib/types";
import { useBoardStore } from "@/store/useBoardStore";

const AVATAR_COLORS = [
  "bg-indigo-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-sky-600",
];

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function Header() {
  const board = useBoardStore((s) => s.board);
  const columns = useBoardStore((s) => s.columns);
  const isSidebarOpen = useBoardStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useBoardStore((s) => s.setSidebarOpen);
  const openBoardModal = useBoardStore((s) => s.openBoardModal);
  const openTaskModal = useBoardStore((s) => s.openTaskModal);
  const deleteBoard = useBoardStore((s) => s.deleteBoard);
  const activeBoardId = useBoardStore((s) => s.activeBoardId);
  const activeUsers = useBoardStore((s) => s.activeUsers);
  const openLogDrawer = useBoardStore((s) => s.openLogDrawer);

  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleDelete = async () => {
    if (!activeBoardId || !board) return;
    setMenuOpen(false);
    if (!window.confirm(`Delete "${board.name}" and all its tasks?`)) return;
    setBusy(true);
    try {
      await deleteBoard(activeBoardId);
    } catch {
      // Store already toasted the failure.
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:h-20 md:px-6 dark:border-white/5 dark:bg-[#2b2c37]">
      {/* Mobile sidebar toggle */}
      <button
        className="rounded p-1 text-slate-500 md:hidden dark:text-slate-300"
        aria-label="Toggle boards menu"
        onClick={() => setSidebarOpen(!isSidebarOpen)}
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Desktop show-sidebar eye when collapsed */}
      {!isSidebarOpen && (
        <button
          className="mr-1 hidden rounded-full bg-indigo-600 p-2 text-white md:block"
          aria-label="Show sidebar"
          onClick={() => setSidebarOpen(true)}
        >
          <Eye className="h-4 w-4" />
        </button>
      )}

      <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-slate-900 md:text-xl dark:text-white">
        {board?.name ?? "No board selected"}
      </h1>

      {activeUsers.length > 0 && (
        <div
          className="hidden items-center sm:flex"
          title={`Online: ${activeUsers.map((u) => u.name).join(", ")}`}
          aria-label={`${activeUsers.length} user${activeUsers.length === 1 ? "" : "s"} online`}
        >
          <div className="flex -space-x-2">
            {activeUsers.slice(0, 3).map((u) => (
              <span
                key={u.id}
                title={u.name}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#2b2c37] ${colorFor(u.id)}`}
              >
                {initials(u.name)}
              </span>
            ))}
          </div>
          {activeUsers.length > 3 ? (
            <span className="ml-1 text-xs font-bold text-slate-400">
              +{activeUsers.length - 3}
            </span>
          ) : (
            <span className="ml-2 hidden text-xs font-bold text-emerald-500 lg:inline">
              {activeUsers.length} online
            </span>
          )}
        </div>
      )}

      <button
        disabled={!board}
        onClick={openLogDrawer}
        aria-label="View activity log"
        title="Activity"
        className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40 md:px-4 dark:text-slate-300 dark:hover:bg-white/5"
      >
        <History className="h-4 w-4" />
        <span className="hidden lg:inline">Activity</span>
      </button>

      <button
        disabled={!board || columns.length === 0}
        onClick={() => openTaskModal("create")}
        className="flex items-center gap-1 rounded-full bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Add New Task</span>
        <span className="sm:hidden">Add</span>
      </button>

      <div className="relative" ref={menuRef}>
        <button
          disabled={!board || busy}
          aria-label="Board options"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-40 md:p-2 dark:text-slate-300 dark:hover:bg-white/5"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-lg bg-white py-2 shadow-xl dark:bg-[#20212c]">
            <button
              onClick={() => {
                setMenuOpen(false);
                openBoardModal("edit");
              }}
              className="block w-full px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
            >
              Edit Board
            </button>
            <button
              onClick={handleDelete}
              className="block w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              Delete Board
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
