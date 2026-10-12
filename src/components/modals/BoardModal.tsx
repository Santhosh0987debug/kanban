"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useBoardStore } from "@/store/useBoardStore";
import { Modal } from "./Modal";

export function BoardModal() {
  const boardModal = useBoardStore((s) => s.boardModal);
  const board = useBoardStore((s) => s.board);
  const columns = useBoardStore((s) => s.columns);

  if (!boardModal.open) return null;

  // Key remount resets form state on each open/mode switch — no sync effect needed.
  const key =
    boardModal.mode === "edit"
      ? `edit-${board?._id ?? "none"}-${columns.map((c) => c._id).join(",")}`
      : "create";

  return (
    <BoardForm
      key={key}
      mode={boardModal.mode}
      initialName={boardModal.mode === "edit" ? (board?.name ?? "") : ""}
      initialCols={
        boardModal.mode === "edit"
          ? columns.map((c) => c.name)
          : ["Todo", "Doing", "Done"]
      }
    />
  );
}

function BoardForm({
  mode,
  initialName,
  initialCols,
}: {
  mode: "create" | "edit";
  initialName: string;
  initialCols: string[];
}) {
  const closeBoardModal = useBoardStore((s) => s.closeBoardModal);
  const board = useBoardStore((s) => s.board);
  const columns = useBoardStore((s) => s.columns);
  const createBoard = useBoardStore((s) => s.createBoard);
  const updateBoard = useBoardStore((s) => s.updateBoard);

  const isEdit = mode === "edit";
  const [name, setName] = useState(initialName);
  const [cols, setCols] = useState<string[]>(initialCols);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setCol = (i: number, value: string) =>
    setCols((prev) => prev.map((c, idx) => (idx === i ? value : c)));
  const addCol = () => setCols((prev) => [...prev, ""]);
  const removeCol = (i: number) =>
    setCols((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedCols = cols.map((c) => c.trim());
    if (!trimmedName) {
      setError("Board name is required.");
      return;
    }
    if (trimmedCols.some((c) => !c)) {
      setError("Column names cannot be empty.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (isEdit && board) {
        // Keep column ids positionally so renames sync Task.status.
        const payload = trimmedCols.map((colName, i) =>
          columns[i] ? { _id: columns[i]._id, name: colName } : { name: colName }
        );
        await updateBoard(board._id, { name: trimmedName, columns: payload });
      } else {
        await createBoard(trimmedName, trimmedCols);
      }
      closeBoardModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save board");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEdit ? "Edit Board" : "Add New Board"}
      onClose={closeBoardModal}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-bold text-slate-500 dark:text-slate-300">
            Board Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Platform Launch"
            maxLength={60}
            className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-600 dark:border-white/10 dark:bg-[#20212c] dark:text-white"
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-300">
            Board Columns
          </p>
          <div className="space-y-2">
            {cols.map((col, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={col}
                  onChange={(e) => setCol(i, e.target.value)}
                  placeholder="e.g. Todo"
                  maxLength={30}
                  className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-600 dark:border-white/10 dark:bg-[#20212c] dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => removeCol(i)}
                  aria-label={`Remove column ${i + 1}`}
                  className="rounded p-1 text-slate-400 hover:text-red-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addCol}
            className="mt-3 w-full rounded-full bg-indigo-100 py-2 text-sm font-bold text-indigo-600 hover:bg-indigo-200 dark:bg-white dark:text-indigo-600"
          >
            + Add New Column
          </button>
        </div>

        {error && <p className="text-sm font-bold text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create New Board"}
        </button>
      </form>
    </Modal>
  );
}
