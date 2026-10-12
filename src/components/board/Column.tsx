"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/cn";
import { tasksInColumn, type ColumnDto, type TaskDto } from "@/lib/types";
import { TaskCard } from "./TaskCard";

interface Props {
  column: ColumnDto;
  tasks: TaskDto[];
}

export function Column({ column, tasks }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: column._id,
    data: { type: "column", columnId: column._id },
  });

  const ordered = tasksInColumn(tasks, column._id);
  const ids = ordered.map((t) => t._id);

  return (
    <section className="flex w-[280px] shrink-0 flex-col" aria-label={column.name}>
      <div className="flex items-center gap-2 px-1 pb-4">
        <span
          className="h-3 w-3 rounded-full bg-indigo-500"
          aria-hidden
        />
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
          {column.name} ({ordered.length})
        </h2>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-4 rounded-lg p-1 transition-colors",
          isOver && "bg-indigo-100/60 ring-2 ring-indigo-400/50 dark:bg-white/5"
        )}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ordered.map((task) => (
            <TaskCard key={task._id} task={task} />
          ))}
        </SortableContext>
        {ordered.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center",
              isOver
                ? "border-indigo-400 text-indigo-500"
                : "border-slate-300/70 text-slate-400 dark:border-white/10"
            )}
          >
            <Inbox className="h-5 w-5" />
            <p className="text-xs font-bold">
              {isOver ? "Release to drop" : "Drag tasks here"}
            </p>
          </motion.div>
        )}
      </div>
    </section>
  );
}
