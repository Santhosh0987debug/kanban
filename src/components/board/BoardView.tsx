"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ClipboardList, Columns3 } from "lucide-react";
import { tasksInColumn, type TaskDto } from "@/lib/types";
import { useBoardStore } from "@/store/useBoardStore";
import { Column } from "./Column";
import { TaskCard } from "./TaskCard";
import { BoardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorBoundary";

export function BoardView() {
  const board = useBoardStore((s) => s.board);
  const boards = useBoardStore((s) => s.boards);
  const columns = useBoardStore((s) => s.columns);
  const tasks = useBoardStore((s) => s.tasks);
  const loadingBoard = useBoardStore((s) => s.loadingBoard);
  const loadingBoards = useBoardStore((s) => s.loadingBoards);
  const error = useBoardStore((s) => s.error);
  const activeBoardId = useBoardStore((s) => s.activeBoardId);
  const moveTask = useBoardStore((s) => s.moveTask);
  const fetchBoardDetail = useBoardStore((s) => s.fetchBoardDetail);
  const openBoardModal = useBoardStore((s) => s.openBoardModal);
  const openTaskModal = useBoardStore((s) => s.openTaskModal);

  const [activeTask, setActiveTask] = useState<TaskDto | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const taskById = useMemo(() => new Map(tasks.map((t) => [t._id, t])), [tasks]);
  const columnIds = useMemo(() => new Set(columns.map((c) => c._id)), [columns]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = taskById.get(String(event.active.id));
    setActiveTask(task ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);
    const moving = taskById.get(taskId);
    if (!moving) return;

    // Destination column: over a column directly, or over another task.
    let destColumnId: string;
    let destIndex: number;
    if (columnIds.has(overId)) {
      destColumnId = overId;
      destIndex = tasksInColumn(tasks, destColumnId).length;
    } else {
      const overTask = taskById.get(overId);
      if (!overTask) return;
      destColumnId = overTask.columnId;
      destIndex = tasksInColumn(tasks, destColumnId).findIndex(
        (t) => t._id === overId
      );
    }

    const sourceList = tasksInColumn(tasks, moving.columnId);
    const sourceIndex = sourceList.findIndex((t) => t._id === taskId);
    if (moving.columnId === destColumnId) {
      // Account for the dragged item being removed from its own list.
      const without = sourceList.filter((t) => t._id !== taskId);
      if (destIndex > without.length) destIndex = without.length;
      if (sourceIndex === destIndex) return;
    }

    // moveTask is optimistic with rollback + toast feedback on failure.
    try {
      await moveTask(taskId, destColumnId, destIndex);
    } catch {
      // Store already toasted the conflict/rollback notice.
    }
  };

  if (loadingBoards || loadingBoard) {
    return <BoardSkeleton />;
  }

  if (error && !board && boards.length > 0) {
    return (
      <ErrorState
        title="Couldn't load this board"
        message={error}
        onRetry={() => {
          if (activeBoardId) void fetchBoardDetail(activeBoardId);
        }}
      />
    );
  }

  if (!board) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="No boards yet"
        description="Create your first board to start organizing tasks into columns."
        actionLabel="Create New Board"
        onAction={() => openBoardModal("create")}
      />
    );
  }

  if (columns.length === 0) {
    return (
      <EmptyState
        icon={Columns3}
        title="This board has no columns"
        description="Columns like Todo, Doing, and Done help you track work as it moves forward."
        actionLabel="Add Column"
        onAction={() => openBoardModal("edit")}
      />
    );
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 gap-6 overflow-x-auto overflow-y-auto p-4 md:p-6">
          {columns.map((column) => (
            <Column key={column._id} column={column} tasks={tasks} />
          ))}
          <button
            onClick={() => openTaskModal("create")}
            className="mt-10 h-fit shrink-0 rounded-lg px-4 py-2 text-sm font-bold text-slate-400 hover:text-indigo-600 dark:hover:text-white"
          >
            + New Task
          </button>
        </div>
        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
