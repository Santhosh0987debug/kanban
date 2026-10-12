"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";
import {
  formatDueDate,
  fromDateInputValue,
  initials,
  isOverdue,
  subtaskProgress,
  toDateInputValue,
  type TaskDto,
} from "@/lib/types";
import { useBoardStore } from "@/store/useBoardStore";
import { Modal } from "./Modal";

export function ViewTaskModal() {
  const viewTaskId = useBoardStore((s) => s.viewTaskId);
  const tasks = useBoardStore((s) => s.tasks);

  if (!viewTaskId) return null;
  const task = tasks.find((t) => t._id === viewTaskId) ?? null;
  if (!task) return null;

  // Remount the body on every task change so inline editors reset to latest.
  return <ViewTaskBody key={`${task._id}-${task.updatedAt}`} task={task} />;
}

function ViewTaskBody({ task }: { task: TaskDto }) {
  const openViewTask = useBoardStore((s) => s.openViewTask);
  const columns = useBoardStore((s) => s.columns);
  const toggleSubtask = useBoardStore((s) => s.toggleSubtask);
  const updateTask = useBoardStore((s) => s.updateTask);
  const deleteTask = useBoardStore((s) => s.deleteTask);
  const openTaskModal = useBoardStore((s) => s.openTaskModal);

  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState(task.assignedTo ?? "");
  const [dueDate, setDueDate] = useState(toDateInputValue(task.dueDate));
  const [savingDetails, setSavingDetails] = useState(false);

  const detailsDirty =
    assignedTo.trim() !== (task.assignedTo ?? "") ||
    dueDate !== toDateInputValue(task.dueDate);

  const handleToggle = async (subtaskId: string, current: boolean) => {
    setError(null);
    try {
      await toggleSubtask(task._id, subtaskId, !current);
    } catch {
      setError("Failed to update subtask.");
    }
  };

  const handleStatusChange = async (status: string) => {
    setError(null);
    const column = columns.find((c) => c.name === status);
    if (!column) return;
    try {
      await updateTask(task._id, { status, columnId: column._id });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change status.");
    }
  };

  const handleSaveDetails = async () => {
    setError(null);
    setSavingDetails(true);
    try {
      await updateTask(task._id, {
        assignedTo: assignedTo.trim(),
        dueDate: fromDateInputValue(dueDate),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save details.");
    } finally {
      setSavingDetails(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await deleteTask(task._id);
    } catch {
      setError("Failed to delete task.");
    }
  };

  return (
    <Modal title={task.title} onClose={() => openViewTask(null)} wide>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold text-slate-400">
            {subtaskProgress(task)}
          </p>
          <div className="relative">
            <button
              aria-label="Task options"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-36 overflow-hidden rounded-lg bg-white shadow-xl dark:bg-[#20212c]">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    openTaskModal("edit", { taskId: task._id });
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  Edit Task
                </button>
                <button
                  onClick={handleDelete}
                  className="block w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Delete Task
                </button>
              </div>
            )}
          </div>
        </div>

        {task.description && (
          <p className="text-sm leading-6 text-slate-500 dark:text-slate-300">
            {task.description}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-300">
              Assigned to
            </label>
            <div className="flex items-center gap-2">
              {assignedTo.trim() && (
                <span
                  title={assignedTo.trim()}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white"
                >
                  {initials(assignedTo)}
                </span>
              )}
              <input
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                onBlur={() => {
                  if (detailsDirty) void handleSaveDetails();
                }}
                placeholder="Unassigned"
                maxLength={60}
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-600 dark:border-white/10 dark:bg-[#20212c] dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-300">
              Due date
              {task.dueDate && (
                <span
                  className={`ml-2 font-bold ${isOverdue(task.dueDate) ? "text-red-500" : "text-slate-400"}`}
                >
                  {isOverdue(task.dueDate)
                    ? `(overdue · ${formatDueDate(task.dueDate)})`
                    : `(${formatDueDate(task.dueDate)})`}
                </span>
              )}
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => {
                const next = e.target.value;
                setDueDate(next);
                // Date picker commits on selection — persist immediately.
                if (next !== toDateInputValue(task.dueDate)) {
                  setError(null);
                  setSavingDetails(true);
                  updateTask(task._id, {
                    dueDate: fromDateInputValue(next),
                  })
                    .catch((err) =>
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Failed to save due date."
                      )
                    )
                    .finally(() => setSavingDetails(false));
                }
              }}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-600 dark:border-white/10 dark:bg-[#20212c] dark:text-white dark:[color-scheme:dark]"
            />
          </div>
        </div>
        {detailsDirty && (
          <button
            onClick={handleSaveDetails}
            disabled={savingDetails}
            className="rounded-full bg-indigo-100 px-4 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-200 disabled:opacity-50 dark:bg-white dark:text-indigo-600"
          >
            {savingDetails ? "Saving…" : "Save details"}
          </button>
        )}

        <div>
          <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-300">
            Subtasks ({task.subtasks.filter((s) => s.isCompleted).length} of{" "}
            {task.subtasks.length})
          </p>
          <div className="space-y-2">
            {task.subtasks.length === 0 && (
              <p className="text-sm text-slate-400">No subtasks.</p>
            )}
            {task.subtasks.map((sub) => (
              <label
                key={sub._id}
                className="flex cursor-pointer items-center gap-3 rounded bg-slate-100 px-3 py-2.5 hover:bg-indigo-100 dark:bg-[#20212c] dark:hover:bg-indigo-600/20"
              >
                <input
                  type="checkbox"
                  checked={sub.isCompleted}
                  onChange={() => handleToggle(sub._id, sub.isCompleted)}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span
                  className={`text-sm font-bold ${
                    sub.isCompleted
                      ? "text-slate-400 line-through"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {sub.title}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-300">
            Current Status
          </label>
          <select
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-600 dark:border-white/10 dark:bg-[#20212c] dark:text-white"
          >
            {columns.map((c) => (
              <option key={c._id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm font-bold text-red-500">{error}</p>}
      </div>
    </Modal>
  );
}
