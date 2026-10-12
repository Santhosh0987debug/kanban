/** Shared client-side DTOs (match API lean JSON shapes). */

export interface BoardSummary {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ColumnDto {
  _id: string;
  name: string;
  boardId: string;
  order: number;
}

export interface SubtaskDto {
  _id: string;
  title: string;
  isCompleted: boolean;
  taskId: string;
  boardId: string;
}

export interface TaskDto {
  _id: string;
  title: string;
  description: string;
  status: string;
  columnId: string;
  boardId: string;
  order: number;
  assignedTo: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks: SubtaskDto[];
}

export interface ActivityLogDto {
  _id: string;
  boardId: string;
  action: string;
  actorName: string;
  createdAt: string;
}

export interface PresenceUser {
  id: string;
  name: string;
}

export interface BoardDetailResponse {
  board: BoardSummary;
  columns: ColumnDto[];
  tasks: TaskDto[];
}

export function subtaskProgress(task: Pick<TaskDto, "subtasks">): string {
  const done = task.subtasks.filter((s) => s.isCompleted).length;
  return `${done} of ${task.subtasks.length} subtasks`;
}

export function tasksInColumn(tasks: TaskDto[], columnId: string): TaskDto[] {
  return tasks
    .filter((t) => t.columnId === columnId)
    .sort((a, b) => a.order - b.order);
}

/** "Ada Lovelace" -> "AL", "ada" -> "A". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "2026-10-20T..." -> "Oct 20" (adds year when not the current year). */
export function formatDueDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions =
    d.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  return d.toLocaleDateString("en-US", opts);
}

/** True when the due date is before the start of today. */
export function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

/** ISO string -> "2026-10-20" for <input type="date">. */
export function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** "2026-10-20" -> ISO string at local midnight, or null when empty. */
export function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** "2026-10-20T..." -> "2m ago", "3h ago", "Yesterday", "Oct 12". */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
