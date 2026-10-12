"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  formatDueDate,
  initials,
  isOverdue,
  subtaskProgress,
  type TaskDto,
} from "@/lib/types";
import { useBoardStore } from "@/store/useBoardStore";

interface Props {
  task: TaskDto;
  overlay?: boolean;
}

export function TaskCard({ task, overlay }: Props) {
  const openViewTask = useBoardStore((s) => s.openViewTask);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    data: { type: "task", columnId: task.columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const done = task.subtasks.filter((s) => s.isCompleted).length;
  const overdue = isOverdue(task.dueDate);
  const showMeta = task.dueDate || task.assignedTo;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={() => !overlay && openViewTask(task._id)}
      className={cn(
        "cursor-pointer rounded-lg bg-white shadow-[0_4px_6px_rgba(54,78,126,0.1)] transition-opacity dark:bg-[#2b2c37]",
        isDragging && "opacity-40",
        overlay && "rotate-2 shadow-xl"
      )}
    >
      {/* Inner motion wrapper so entrance animation never fights dnd-kit's
          transform on the draggable node. */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        whileHover={overlay ? undefined : { y: -2 }}
        className="rounded-lg px-4 py-3"
      >
        <p className="text-[15px] font-bold text-slate-900 dark:text-white">
          {task.title}
        </p>
        <p className="mt-1 text-xs font-bold text-slate-400">
          {done === 0 && task.subtasks.length === 0
            ? "0 subtasks"
            : subtaskProgress(task)}
        </p>
        {showMeta && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {task.dueDate && (
              <span
                title={`Due ${formatDueDate(task.dueDate)}`}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                  overdue
                    ? "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                    : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300"
                )}
              >
                <CalendarDays className="h-3 w-3" />
                {formatDueDate(task.dueDate)}
              </span>
            )}
            {task.assignedTo && (
              <span
                title={`Assigned to ${task.assignedTo}`}
                className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white"
              >
                {initials(task.assignedTo)}
              </span>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
