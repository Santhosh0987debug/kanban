"use client";

import { create } from "zustand";
import { toast } from "sonner";
import { getSocket } from "@/lib/socket-client";
import { SocketEvents } from "@/lib/socket-events";
import type {
  ActivityLogDto,
  BoardDetailResponse,
  BoardSummary,
  ColumnDto,
  PresenceUser,
  SubtaskDto,
  TaskDto,
} from "@/lib/types";

export interface BoardModalState {
  open: boolean;
  mode: "create" | "edit";
}

export interface TaskModalState {
  open: boolean;
  mode: "create" | "edit";
  taskId: string | null;
  defaultStatus: string | null;
}

interface BoardData {
  board: BoardSummary | null;
  columns: ColumnDto[];
  tasks: TaskDto[];
}

interface BoardStore {
  // ---- state (spec fields) ----
  boards: BoardSummary[];
  activeBoardId: string | null;
  boardData: BoardData;
  isSidebarOpen: boolean;
  isDarkTheme: boolean;
  // ---- derived shortcuts ----
  board: BoardSummary | null;
  columns: ColumnDto[];
  tasks: TaskDto[];
  loadingBoards: boolean;
  loadingBoard: boolean;
  error: string | null;
  // ---- ui state ----
  viewTaskId: string | null;
  boardModal: BoardModalState;
  taskModal: TaskModalState;
  // ---- collaboration ----
  user: PresenceUser;
  activeUsers: PresenceUser[];
  activityLogs: ActivityLogDto[];
  loadingLogs: boolean;
  isLogDrawerOpen: boolean;
  // ---- actions ----
  fetchBoards: () => Promise<void>;
  setActiveBoard: (boardId: string | null) => Promise<void>;
  fetchBoardDetail: (boardId: string) => Promise<void>;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTheme: () => void;
  applyStoredTheme: () => void;
  openBoardModal: (mode: "create" | "edit") => void;
  closeBoardModal: () => void;
  openTaskModal: (
    mode: "create" | "edit",
    opts?: { taskId?: string | null; defaultStatus?: string | null }
  ) => void;
  closeTaskModal: () => void;
  openViewTask: (taskId: string | null) => void;
  // ---- optimistic mutations ----
  createBoard: (name: string, columns: string[]) => Promise<BoardSummary>;
  updateBoard: (
    boardId: string,
    input: { name?: string; columns?: { _id?: string; name: string }[] }
  ) => Promise<void>;
  deleteBoard: (boardId: string) => Promise<void>;
  createTask: (input: {
    title: string;
    description?: string;
    columnId: string;
    status?: string;
    assignedTo?: string;
    dueDate?: string | null;
    subtasks?: { title: string }[];
  }) => Promise<TaskDto>;
  updateTask: (
    taskId: string,
    input: {
      title?: string;
      description?: string;
      status?: string;
      columnId?: string;
      assignedTo?: string;
      dueDate?: string | null;
      subtasks?: { _id?: string; title: string; isCompleted?: boolean }[];
    }
  ) => Promise<void>;
  toggleSubtask: (
    taskId: string,
    subtaskId: string,
    isCompleted: boolean
  ) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  moveTask: (taskId: string, toColumnId: string, toIndex: number) => Promise<void>;
  // ---- collaboration actions ----
  fetchLogs: (boardId: string) => Promise<void>;
  logActivity: (boardId: string, action: string) => Promise<void>;
  openLogDrawer: () => void;
  closeLogDrawer: () => void;
  // ---- realtime ----
  subscribeRealtime: () => void;
  unsubscribeRealtime: () => void;
}

function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function applyDarkClass(isDark: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", isDark);
}

function randomSuffix(): string {
  try {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return (bytes[0] % 1296).toString(36).toUpperCase().padStart(2, "0");
  } catch {
    return Math.random().toString(36).slice(2, 4).toUpperCase();
  }
}

/** Stable per-browser collaborator identity for presence + audit logs. */
function getUserIdentity(): PresenceUser {
  const storedId = readStored("kanban:userId");
  const storedName = readStored("kanban:userName");
  if (storedId && storedName) return { id: storedId, name: storedName };
  const id =
    storedId ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `user-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const name = storedName ?? `Guest-${randomSuffix()}`;
  writeStored("kanban:userId", id);
  writeStored("kanban:userName", name);
  return { id, name };
}

const MAX_LOGS = 50;

const initialDark =
  typeof window !== "undefined"
    ? (readStored("kanban:theme") ?? "dark") === "dark"
    : true;

if (typeof window !== "undefined") {
  applyDarkClass(initialDark);
}

let realtimeSubscribed = false;

export const useBoardStore = create<BoardStore>()((set, get) => ({
  boards: [],
  activeBoardId:
    typeof window !== "undefined" ? readStored("kanban:activeBoard") : null,
  boardData: { board: null, columns: [], tasks: [] },
  isSidebarOpen: true,
  isDarkTheme: initialDark,

  board: null,
  columns: [],
  tasks: [],
  loadingBoards: false,
  loadingBoard: false,
  error: null,

  viewTaskId: null,
  boardModal: { open: false, mode: "create" },
  taskModal: { open: false, mode: "create", taskId: null, defaultStatus: null },

  user: typeof window !== "undefined" ? getUserIdentity() : { id: "", name: "Anonymous" },
  activeUsers: [],
  activityLogs: [],
  loadingLogs: false,
  isLogDrawerOpen: false,

  fetchBoards: async () => {
    set({ loadingBoards: true, error: null });
    try {
      const res = await fetch("/api/boards", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load boards");
      const data = (await res.json()) as { boards: BoardSummary[] };
      const boards = data.boards ?? [];
      set({ boards, loadingBoards: false });

      const { activeBoardId, fetchBoardDetail } = get();
      if (boards.length > 0) {
        const stillExists = boards.some((b) => b._id === activeBoardId);
        const next = stillExists ? activeBoardId! : boards[0]._id;
        if (next !== activeBoardId) {
          writeStored("kanban:activeBoard", next);
          set({ activeBoardId: next });
        }
        await fetchBoardDetail(next);
      } else {
        set({
          activeBoardId: null,
          board: null,
          columns: [],
          tasks: [],
          boardData: { board: null, columns: [], tasks: [] },
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load boards";
      set({
        loadingBoards: false,
        error: message,
      });
      toast.error("Couldn't load boards. Check your connection.");
    }
  },

  setActiveBoard: async (boardId) => {
    if (!boardId) {
      set({
        activeBoardId: null,
        board: null,
        columns: [],
        tasks: [],
        boardData: { board: null, columns: [], tasks: [] },
      });
      return;
    }
    writeStored("kanban:activeBoard", boardId);
    set({ activeBoardId: boardId, activeUsers: [] });
    await get().fetchBoardDetail(boardId);
    void get().fetchLogs(boardId);
  },

  fetchBoardDetail: async (boardId) => {
    set({ loadingBoard: true, error: null });
    try {
      const res = await fetch(`/api/boards/${boardId}`, { cache: "no-store" });
      if (res.status === 404) throw new Error("Board not found");
      if (!res.ok) throw new Error("Failed to load board");
      const data = (await res.json()) as BoardDetailResponse;
      set({
        board: data.board,
        columns: data.columns,
        tasks: data.tasks,
        boardData: {
          board: data.board,
          columns: data.columns,
          tasks: data.tasks,
        },
        loadingBoard: false,
        activeBoardId: data.board._id,
      });
      writeStored("kanban:activeBoard", data.board._id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load board";
      set({
        loadingBoard: false,
        error: message,
      });
      toast.error("Couldn't load board. Check your connection.");
    }
  },

  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),

  toggleTheme: () => {
    const next = !get().isDarkTheme;
    set({ isDarkTheme: next });
    writeStored("kanban:theme", next ? "dark" : "light");
    applyDarkClass(next);
  },

  applyStoredTheme: () => {
    const stored = readStored("kanban:theme");
    const isDark = stored ? stored === "dark" : get().isDarkTheme;
    set({ isDarkTheme: isDark });
    applyDarkClass(isDark);
  },

  openBoardModal: (mode) => set({ boardModal: { open: true, mode } }),
  closeBoardModal: () =>
    set((s) => ({ boardModal: { ...s.boardModal, open: false } })),

  openTaskModal: (mode, opts) =>
    set({
      taskModal: {
        open: true,
        mode,
        taskId: opts?.taskId ?? null,
        defaultStatus: opts?.defaultStatus ?? null,
      },
      // Opening the edit modal closes the viewer to avoid stacking.
      viewTaskId: mode === "edit" ? null : get().viewTaskId,
    }),
  closeTaskModal: () =>
    set((s) => ({ taskModal: { ...s.taskModal, open: false } })),

  openViewTask: (taskId) => set({ viewTaskId: taskId }),

  // ---------------- mutations ----------------

  createBoard: async (name, columns) => {
    const res = await fetch("/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, columns }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      const message = j?.error ?? "Failed to create board";
      toast.error(message);
      throw new Error(message);
    }
    const data = (await res.json()) as {
      board: BoardSummary;
      columns: ColumnDto[];
    };
    set((s) => ({ boards: [data.board, ...s.boards] }));
    await get().setActiveBoard(data.board._id);
    getSocket().emit(SocketEvents.BoardUpdated, {
      boardId: data.board._id,
      board: data.board,
      columns: data.columns,
    });
    toast.success(`Board "${data.board.name}" created`);
    void get().logActivity(data.board._id, `created board "${data.board.name}"`);
    return data.board;
  },

  updateBoard: async (boardId, input) => {
    const snapshot = {
      boards: get().boards,
      board: get().board,
      columns: get().columns,
    };
    // Optimistic board rename.
    if (input.name && get().board?._id === boardId) {
      const renamed = { ...get().board!, name: input.name };
      set({ board: renamed, boardData: { ...get().boardData, board: renamed } });
    }
    set((s) => ({
      boards: s.boards.map((b) =>
        b._id === boardId && input.name ? { ...b, name: input.name } : b
      ),
    }));

    try {
      const res = await fetch(`/api/boards/${boardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (res.status === 409) throw new Error("Board was modified elsewhere");
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Failed to update board");
      }
      const data = (await res.json()) as {
        board: BoardSummary;
        columns: ColumnDto[];
      };
      set((s) => ({
        boards: s.boards.map((b) => (b._id === boardId ? data.board : b)),
        board: s.activeBoardId === boardId ? data.board : s.board,
        columns: s.activeBoardId === boardId ? data.columns : s.columns,
        boardData:
          s.activeBoardId === boardId
            ? { ...s.boardData, board: data.board, columns: data.columns }
            : s.boardData,
      }));
      // Column deletes may orphan tasks client-side; refetch for truth.
      if (sActiveBoard(get(), boardId) && input.columns !== undefined) {
        await get().fetchBoardDetail(boardId);
      }
      getSocket().emit(SocketEvents.BoardUpdated, {
        boardId,
        board: data.board,
        columns: data.columns,
      });
      toast.success("Board updated");
      void get().logActivity(boardId, `updated board "${data.board.name}"`);
    } catch (err) {
      set({
        boards: snapshot.boards,
        board: snapshot.board,
        columns: snapshot.columns,
        boardData: {
          board: snapshot.board,
          columns: snapshot.columns,
          tasks: get().tasks,
        },
      });
      toast.error("Couldn't update board — changes reverted");
      throw err;
    }
  },

  deleteBoard: async (boardId) => {
    const snapshot = get().boards;
    set((s) => ({ boards: s.boards.filter((b) => b._id !== boardId) }));
    try {
      const res = await fetch(`/api/boards/${boardId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete board");
      const remaining = get().boards;
      if (get().activeBoardId === boardId) {
        if (remaining.length > 0) await get().setActiveBoard(remaining[0]._id);
        else {
          set({
            activeBoardId: null,
            board: null,
            columns: [],
            tasks: [],
            boardData: { board: null, columns: [], tasks: [] },
          });
        }
      }
      toast.success("Board deleted");
    } catch (err) {
      set({ boards: snapshot });
      toast.error("Couldn't delete board");
      throw err;
    }
  },

  createTask: async (input) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const column = get().columns.find((c) => c._id === input.columnId);
    const status = input.status ?? column?.name ?? "";
    const siblings = get().tasks.filter((t) => t.columnId === input.columnId);
    const maxOrder = siblings.length
      ? Math.max(...siblings.map((t) => t.order))
      : 0;
    const optimistic: TaskDto = {
      _id: tempId,
      title: input.title,
      description: input.description ?? "",
      status,
      columnId: input.columnId,
      boardId: get().activeBoardId ?? "",
      order: maxOrder + 1000,
      assignedTo: input.assignedTo ?? "",
      dueDate: input.dueDate ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subtasks: (input.subtasks ?? []).map((s, i) => ({
        _id: `${tempId}-sub-${i}`,
        title: s.title,
        isCompleted: false,
        taskId: tempId,
        boardId: get().activeBoardId ?? "",
      })),
    };
    set((s) => {
      const tasks = [...s.tasks, optimistic];
      return { tasks, boardData: { ...s.boardData, tasks } };
    });

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        const message = j?.error ?? "Failed to create task";
        set((s) => {
          const tasks = s.tasks.filter((t) => t._id !== tempId);
          return { tasks, boardData: { ...s.boardData, tasks } };
        });
        toast.error(message);
        throw new Error(message);
      }
      const data = (await res.json()) as {
        task: TaskDto;
        subtasks: SubtaskDto[];
      };
      const created: TaskDto = { ...data.task, subtasks: data.subtasks };
      set((s) => {
        const tasks = s.tasks.map((t) => (t._id === tempId ? created : t));
        return { tasks, boardData: { ...s.boardData, tasks } };
      });
      getSocket().emit(SocketEvents.TaskCreated, {
        boardId: created.boardId,
        task: created,
        subtasks: created.subtasks,
      });
      toast.success(`Task "${created.title}" created`);
      void get().logActivity(created.boardId, `created task "${created.title}"`);
      return created;
    } catch (err) {
      set((s) => {
        const tasks = s.tasks.filter((t) => t._id !== tempId);
        return { tasks, boardData: { ...s.boardData, tasks } };
      });
      throw err;
    }
  },

  updateTask: async (taskId, input) => {
    const prev = get().tasks.find((t) => t._id === taskId);
    if (!prev) throw new Error("Task not found");

    const nextSubtasks: SubtaskDto[] | undefined = input.subtasks?.map(
      (s, i) => ({
        _id: s._id ?? `temp-${Date.now()}-${i}`,
        title: s.title,
        isCompleted: s.isCompleted ?? false,
        taskId,
        boardId: prev.boardId,
      })
    );

    set((s) => {
      const tasks = s.tasks.map((t) =>
        t._id === taskId
          ? {
              ...t,
              title: input.title ?? t.title,
              description: input.description ?? t.description,
              status: input.status ?? t.status,
              columnId: input.columnId ?? t.columnId,
              assignedTo: input.assignedTo ?? t.assignedTo,
              dueDate: input.dueDate !== undefined ? input.dueDate : t.dueDate,
              subtasks: nextSubtasks ?? t.subtasks,
              updatedAt: new Date().toISOString(),
            }
          : t
      );
      return { tasks, boardData: { ...s.boardData, tasks } };
    });

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          expectedUpdatedAt: prev.updatedAt,
        }),
      });
      if (res.status === 409) {
        await get().fetchBoardDetail(prev.boardId);
        const message =
          "This task was modified by someone else. Reloaded latest version.";
        toast.error("Edit conflict — reloaded the latest version");
        throw new Error(message);
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Failed to update task");
      }
      const data = (await res.json()) as {
        task: TaskDto;
        subtasks: SubtaskDto[];
      };
      const reconciled: TaskDto = { ...data.task, subtasks: data.subtasks };
      set((s) => {
        const tasks = s.tasks.map((t) => (t._id === taskId ? reconciled : t));
        return { tasks, boardData: { ...s.boardData, tasks } };
      });
      getSocket().emit(SocketEvents.TaskUpdated, {
        boardId: reconciled.boardId,
        task: reconciled,
        subtasks: reconciled.subtasks,
      });
      // Log metadata edits, but not subtask checkbox toggles (too noisy).
      if (
        input.title !== undefined ||
        input.description !== undefined ||
        input.status !== undefined ||
        input.columnId !== undefined ||
        input.assignedTo !== undefined ||
        input.dueDate !== undefined
      ) {
        void get().logActivity(
          reconciled.boardId,
          `updated task "${reconciled.title}"`
        );
      }
    } catch (err) {
      // Roll back to pre-edit snapshot on non-conflict errors
      // (conflict path already refetched).
      if (err instanceof Error && err.message.includes("someone else")) throw err;
      set((s) => {
        const tasks = s.tasks.map((t) => (t._id === taskId ? prev : t));
        return { tasks, boardData: { ...s.boardData, tasks } };
      });
      toast.error("Couldn't update task — changes reverted");
      throw err;
    }
  },

  toggleSubtask: async (taskId, subtaskId, isCompleted) => {
    const task = get().tasks.find((t) => t._id === taskId);
    if (!task) return;
    const subtasks = task.subtasks.map((s) =>
      s._id === subtaskId ? { ...s, isCompleted } : s
    );
    await get().updateTask(taskId, {
      subtasks: subtasks.map((s) => ({
        _id: s._id.startsWith("temp-") ? undefined : s._id,
        title: s.title,
        isCompleted: s.isCompleted,
      })),
    });
  },

  deleteTask: async (taskId) => {
    const prev = get().tasks;
    const target = prev.find((t) => t._id === taskId);
    set((s) => {
      const tasks = s.tasks.filter((t) => t._id !== taskId);
      return {
        tasks,
        boardData: { ...s.boardData, tasks },
        viewTaskId: s.viewTaskId === taskId ? null : s.viewTaskId,
      };
    });
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      if (target) {
        getSocket().emit(SocketEvents.TaskDeleted, {
          boardId: target.boardId,
          taskId,
        });
      }
      toast.success("Task deleted");
      if (target) {
        void get().logActivity(target.boardId, `deleted task "${target.title}"`);
      }
    } catch (err) {
      set((s) => ({ tasks: prev, boardData: { ...s.boardData, tasks: prev } }));
      toast.error("Couldn't delete task — restored");
      throw err;
    }
  },

  moveTask: async (taskId, toColumnId, toIndex) => {
    const state = get();
    const moving = state.tasks.find((t) => t._id === taskId);
    const destColumn = state.columns.find((c) => c._id === toColumnId);
    if (!moving || !destColumn) return;
    const crossColumn = moving.columnId !== toColumnId;

    const snapshot = state.tasks;
    // Optimistic reorder.
    const siblings = snapshot
      .filter((t) => t.columnId === toColumnId && t._id !== taskId)
      .sort((a, b) => a.order - b.order);
    const clamped = Math.max(0, Math.min(toIndex, siblings.length));
    const prevOrder = clamped > 0 ? siblings[clamped - 1].order : null;
    const nextOrder =
      clamped < siblings.length ? siblings[clamped].order : null;
    const optimisticOrder =
      prevOrder == null && nextOrder == null
        ? 1000
        : prevOrder == null
          ? (nextOrder as number) - 1000
          : nextOrder == null
            ? prevOrder + 1000
            : (prevOrder + nextOrder) / 2;

    const optimisticTask: TaskDto = {
      ...moving,
      columnId: toColumnId,
      status: destColumn.name,
      order: optimisticOrder,
      updatedAt: new Date().toISOString(),
    };
    const others = snapshot.filter((t) => t._id !== taskId);
    const destOthers = others
      .filter((t) => t.columnId === toColumnId)
      .sort((a, b) => a.order - b.order);
    destOthers.splice(clamped, 0, optimisticTask);
    const rest = others.filter((t) => t.columnId !== toColumnId);
    const nextTasks = [...rest, ...destOthers];
    set({ tasks: nextTasks, boardData: { ...state.boardData, tasks: nextTasks } });

    try {
      const res = await fetch("/api/tasks/move", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          toColumnId,
          toIndex: clamped,
          expectedUpdatedAt: moving.updatedAt,
        }),
      });
      if (res.status === 409) {
        await get().fetchBoardDetail(moving.boardId);
        toast.error("Move conflict — restored the latest order");
        throw new Error("Someone else moved this task. Reloaded latest order.");
      }
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? "Failed to move task");
      }
      const data = (await res.json()) as { task: TaskDto };
      // Reconcile server order, keep local subtasks (move doesn't touch them).
      set((s) => {
        const tasks = s.tasks.map((t) =>
          t._id === taskId
            ? { ...data.task, subtasks: t.subtasks }
            : t
        );
        return { tasks, boardData: { ...s.boardData, tasks } };
      });
      getSocket().emit(SocketEvents.TaskMoved, {
        boardId: data.task.boardId,
        task: { ...data.task, subtasks: moving.subtasks },
      });
      if (crossColumn) {
        toast.success(`Task moved to "${destColumn.name}"`);
        void get().logActivity(
          data.task.boardId,
          `moved task "${data.task.title}" to "${destColumn.name}"`
        );
      }
    } catch (err) {
      set((s) => ({
        tasks: snapshot,
        boardData: { ...s.boardData, tasks: snapshot },
      }));
      if (err instanceof Error && err.message.includes("Someone else")) {
        throw err;
      }
      toast.error("Couldn't move task — changes reverted");
      throw err;
    }
  },

  fetchLogs: async (boardId) => {
    set({ loadingLogs: true });
    try {
      const res = await fetch(`/api/boards/${boardId}/logs`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load activity");
      const data = (await res.json()) as { logs: ActivityLogDto[] };
      // Only apply if the user hasn't switched boards mid-flight.
      if (get().activeBoardId === boardId) {
        set({ activityLogs: data.logs.slice(0, MAX_LOGS), loadingLogs: false });
      } else {
        set({ loadingLogs: false });
      }
    } catch {
      set({ loadingLogs: false });
    }
  },

  logActivity: async (boardId, action) => {
    try {
      const res = await fetch(`/api/boards/${boardId}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, actorName: get().user.name }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { log: ActivityLogDto };
      if (get().activeBoardId === boardId) {
        set((s) => ({
          activityLogs: [data.log, ...s.activityLogs].slice(0, MAX_LOGS),
        }));
      }
      getSocket().emit(SocketEvents.ActivityLogged, {
        boardId,
        log: data.log,
      });
    } catch {
      // Audit logging must never break the main flow.
    }
  },

  openLogDrawer: () => {
    const { activeBoardId } = get();
    set({ isLogDrawerOpen: true });
    if (activeBoardId) void get().fetchLogs(activeBoardId);
  },
  closeLogDrawer: () => set({ isLogDrawerOpen: false }),

  subscribeRealtime: () => {
    if (realtimeSubscribed || typeof window === "undefined") return;
    realtimeSubscribed = true;
    const socket = getSocket();

    socket.on(SocketEvents.TaskMoved, (payload: { boardId: string; task: TaskDto }) => {
      const { activeBoardId, tasks, boardData } = get();
      if (!payload || payload.boardId !== activeBoardId) return;
      const remote = payload.task;
      const existing = tasks.find((t) => t._id === remote._id);
      const merged: TaskDto = existing
        ? { ...remote, subtasks: existing.subtasks }
        : { ...remote, subtasks: remote.subtasks ?? [] };
      const next = existing
        ? tasks.map((t) => (t._id === merged._id ? merged : t))
        : [...tasks, merged];
      set({ tasks: next, boardData: { ...boardData, tasks: next } });
    });

    socket.on(
      SocketEvents.TaskUpdated,
      (payload: { boardId: string; task: TaskDto; subtasks: SubtaskDto[] }) => {
        const { activeBoardId, tasks, boardData } = get();
        if (!payload || payload.boardId !== activeBoardId) return;
        const merged: TaskDto = { ...payload.task, subtasks: payload.subtasks };
        const exists = tasks.some((t) => t._id === merged._id);
        const next = exists
          ? tasks.map((t) => (t._id === merged._id ? merged : t))
          : [...tasks, merged];
        set({ tasks: next, boardData: { ...boardData, tasks: next } });
      }
    );

    socket.on(
      SocketEvents.TaskCreated,
      (payload: { boardId: string; task: TaskDto; subtasks: SubtaskDto[] }) => {
        const { activeBoardId, tasks, boardData } = get();
        if (!payload || payload.boardId !== activeBoardId) return;
        if (tasks.some((t) => t._id === payload.task._id)) return;
        const created: TaskDto = {
          ...payload.task,
          subtasks: payload.subtasks,
        };
        const next = [...tasks, created];
        set({ tasks: next, boardData: { ...boardData, tasks: next } });
      }
    );

    socket.on(SocketEvents.TaskDeleted, (payload: { boardId: string; taskId: string }) => {
      const { activeBoardId, tasks, boardData } = get();
      if (!payload || payload.boardId !== activeBoardId) return;
      const next = tasks.filter((t) => t._id !== payload.taskId);
      set({
        tasks: next,
        boardData: { ...boardData, tasks: next },
        viewTaskId: get().viewTaskId === payload.taskId ? null : get().viewTaskId,
      });
    });

    socket.on(
      SocketEvents.BoardUpdated,
      (payload: { boardId: string; board?: BoardSummary; columns?: ColumnDto[] }) => {
        const { activeBoardId } = get();
        if (!payload || payload.boardId !== activeBoardId) return;
        // Refetch to pick up renames + column sync + orphan cleanup.
        void get().fetchBoardDetail(payload.boardId);
      }
    );

    socket.on(
      SocketEvents.BoardPresence,
      (payload: { boardId: string; users: PresenceUser[] }) => {
        const { activeBoardId } = get();
        if (!payload || payload.boardId !== activeBoardId) return;
        set({ activeUsers: payload.users ?? [] });
      }
    );

    socket.on(
      SocketEvents.ActivityLogged,
      (payload: { boardId: string; log: ActivityLogDto }) => {
        const { activeBoardId, activityLogs } = get();
        if (!payload || payload.boardId !== activeBoardId || !payload.log) return;
        if (activityLogs.some((l) => l._id === payload.log._id)) return;
        set({ activityLogs: [payload.log, ...activityLogs].slice(0, MAX_LOGS) });
      }
    );
  },

  unsubscribeRealtime: () => {
    if (!realtimeSubscribed || typeof window === "undefined") return;
    realtimeSubscribed = false;
    const socket = getSocket();
    socket.off(SocketEvents.TaskMoved);
    socket.off(SocketEvents.TaskUpdated);
    socket.off(SocketEvents.TaskCreated);
    socket.off(SocketEvents.TaskDeleted);
    socket.off(SocketEvents.BoardUpdated);
    socket.off(SocketEvents.BoardPresence);
    socket.off(SocketEvents.ActivityLogged);
  },
}));

function sActiveBoard(state: { activeBoardId: string | null }, boardId: string) {
  return state.activeBoardId === boardId;
}
