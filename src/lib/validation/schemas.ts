import { z } from "zod";

export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

export const boardCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Board name is required")
    .max(60, "Max 60 characters"),
  columns: z
    .array(z.string().trim().min(1, "Column name cannot be empty").max(30))
    .max(10)
    .optional(),
});

export const boardUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  columns: z
    .array(
      z.object({
        _id: objectId.optional(),
        name: z.string().trim().min(1, "Column name cannot be empty").max(30),
      })
    )
    .max(10)
    .optional(),
});

export const subtaskInputSchema = z.object({
  _id: objectId.optional(),
  title: z.string().trim().min(1, "Subtask title required").max(120),
  isCompleted: z.boolean().optional().default(false),
});

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().max(2000).optional().default(""),
  columnId: objectId,
  boardId: objectId.optional(),
  status: z.string().trim().max(30).optional(),
  order: z.number().optional(),
  assignedTo: z.string().trim().max(60).optional().default(""),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  subtasks: z.array(subtaskInputSchema).max(20).optional().default([]),
});

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  status: z.string().trim().min(1).max(30).optional(),
  columnId: objectId.optional(),
  assignedTo: z.string().trim().max(60).optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  // Last-known updatedAt from the client for conflict detection (409 on stale).
  expectedUpdatedAt: z.string().datetime().optional(),
  subtasks: z.array(subtaskInputSchema).max(20).optional(),
});

export const taskMoveSchema = z.object({
  taskId: objectId,
  toColumnId: objectId,
  // Zero-based index in the destination column (excluding the moving task).
  toIndex: z.number().int().min(0),
  // Last-known updatedAt for conflict detection.
  expectedUpdatedAt: z.string().datetime().optional(),
});

export const activityLogCreateSchema = z.object({
  action: z.string().trim().min(1, "Action is required").max(200),
  actorName: z.string().trim().max(60).optional().default("Anonymous"),
});

export type ActivityLogCreateInput = z.infer<typeof activityLogCreateSchema>;
export type BoardCreateInput = z.infer<typeof boardCreateSchema>;
export type BoardUpdateInput = z.infer<typeof boardUpdateSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type TaskMoveInput = z.infer<typeof taskMoveSchema>;
