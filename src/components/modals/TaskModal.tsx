"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  fromDateInputValue,
  toDateInputValue,
  type TaskDto,
} from "@/lib/types";
import { useBoardStore } from "@/store/useBoardStore";
import { Modal } from "./Modal";

export function TaskModal() {
  const taskModal = useBoardStore((s) => s.taskModal);
  const tasks = useBoardStore((s) => s.tasks);
  const columns = useBoardStore((s) => s.columns);

  if (!taskModal.open) return null;

  const editing =
    taskModal.mode === "edit"
      ? (tasks.find((t) => t._id === taskModal.taskId) ?? null)
      : null;

  const key =
    taskModal.mode === "edit"
      ? `edit-${editing?._id ?? "missing"}-${editing?.updatedAt ?? ""}`
      : `create-${taskModal.defaultStatus ?? columns[0]?.name ?? "none"}`;

  return <TaskForm key={key} mode={taskModal.mode} editing={editing} />;
}

function TaskForm({
  mode,
  editing,
}: {
  mode: "create" | "edit";
  editing: TaskDto | null;
}) {
  const closeTaskModal = useBoardStore((s) => s.closeTaskModal);
  const columns = useBoardStore((s) => s.columns);
  const defaultStatus = useBoardStore((s) => s.taskModal.defaultStatus);
  const createTask = useBoardStore((s) => s.createTask);
  const updateTask = useBoardStore((s) => s.updateTask);

  const isEdit = mode === "edit";
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [status, setStatus] = useState(
    editing?.status ?? defaultStatus ?? columns[0]?.name ?? ""
  );
  const [assignedTo, setAssignedTo] = useState(editing?.assignedTo ?? "");
  const [dueDate, setDueDate] = useState(toDateInputValue(editing?.dueDate ?? null));
  const [subtasks, setSubtasks] = useState<{ _id?: string; title: string }[]>(
    editing
      ? editing.subtasks.map((s) => ({ _id: s._id, title: s.title }))
      : [{ title: "" }, { title: "" }]
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setSub = (i: number, value: string) =>
    setSubtasks((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, title: value } : s))
    );
  const addSub = () => setSubtasks((prev) => [...prev, { title: "" }]);
  const removeSub = (i: number) =>
    setSubtasks((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    if (!status) {
      setError("Status is required.");
      return;
    }
    const trimmedSubs = subtasks
      .map((s) => ({ _id: s._id, title: s.title.trim() }))
      .filter((s) => s.title.length > 0);

    const column = columns.find((c) => c.name === status);
    if (!column) {
      setError("Select a valid status.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      if (isEdit && editing) {
        await updateTask(editing._id, {
          title: trimmedTitle,
          description,
          status,
          columnId: column._id,
          assignedTo: assignedTo.trim(),
          dueDate: fromDateInputValue(dueDate),
          subtasks: trimmedSubs.map((s) => ({
            _id: s._id?.startsWith("temp-") ? undefined : s._id,
            title: s.title,
            isCompleted:
              editing.subtasks.find((es) => es._id === s._id)?.isCompleted ??
              false,
          })),
        });
      } else {
        await createTask({
          title: trimmedTitle,
          description,
          columnId: column._id,
          status,
          assignedTo: assignedTo.trim(),
          dueDate: fromDateInputValue(dueDate),
          subtasks: trimmedSubs.map((s) => ({ title: s.title })),
        });
      }
      closeTaskModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isEdit ? "Edit Task" : "Add New Task"} onClose={closeTaskModal}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-300">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Take coffee break"
            maxLength={120}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-600 dark:border-white/10 dark:bg-[#20212c] dark:text-white"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-300">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. It's always good to take a break."
            rows={3}
            maxLength={2000}
            className="w-full resize-none rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-600 dark:border-white/10 dark:bg-[#20212c] dark:text-white"
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-300">
            Subtasks
          </p>
          <div className="space-y-2">
            {subtasks.map((sub, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={sub.title}
                  onChange={(e) => setSub(i, e.target.value)}
                  placeholder={i === 0 ? "e.g. Make coffee" : "e.g. Drink coffee"}
                  maxLength={120}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-600 dark:border-white/10 dark:bg-[#20212c] dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => removeSub(i)}
                  aria-label={`Remove subtask ${i + 1}`}
                  className="rounded p-1 text-slate-400 hover:text-red-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addSub}
            className="mt-3 w-full rounded-full bg-indigo-100 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-200 dark:bg-white dark:text-indigo-600"
          >
            + Add New Subtask
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-300">
              Assigned to
            </label>
            <input
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="e.g. Ada"
              maxLength={60}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-600 dark:border-white/10 dark:bg-[#20212c] dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-300">
              Due date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-600 dark:border-white/10 dark:bg-[#20212c] dark:text-white dark:[color-scheme:dark]"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-300">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-600 dark:border-white/10 dark:bg-[#20212c] dark:text-white"
          >
            <option value="" disabled>
              Select status
            </option>
            {columns.map((c) => (
              <option key={c._id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm font-bold text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Task"}
        </button>
      </form>
    </Modal>
  );
}
