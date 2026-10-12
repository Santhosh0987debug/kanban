import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Column } from "@/models/Column";
import { Task } from "@/models/Task";
import { Subtask } from "@/models/Subtask";
import { taskUpdateSchema } from "@/lib/validation/schemas";
import {
  assertObjectId,
  badRequest,
  conflict,
  notFound,
  serverError,
  zodError,
} from "@/lib/api-helpers";
import { orderForEnd } from "@/lib/order";

type Params = { params: Promise<{ taskId: string }> };

/**
 * PUT /api/tasks/:taskId — edit title/description/status/column/assignee/due
 * date + sync subtasks.
 * - Renaming status/column moves the task to the end of the target column.
 * - `subtasks` (when provided) is the full desired list: existing items
 *   (with _id) are updated, new items created, missing items deleted.
 * - `expectedUpdatedAt` enables 409 conflict responses for simultaneous edits.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { taskId } = await params;
    if (!assertObjectId(taskId)) return badRequest("Invalid task id");
    await dbConnect();

    const body = await req.json();
    const parsed = taskUpdateSchema.safeParse(body);
    if (!parsed.success) return zodError(parsed.error);

    const task = await Task.findById(taskId);
    if (!task) return notFound("Task");

    const data = parsed.data;

    if (data.expectedUpdatedAt) {
      const expected = new Date(data.expectedUpdatedAt).getTime();
      const current = new Date(task.updatedAt).getTime();
      if (!Number.isNaN(expected) && current > expected + 1000) {
        return conflict(
          "This task was modified by someone else. Reload to get the latest version."
        );
      }
    }

    if (data.title !== undefined) task.title = data.title;
    if (data.description !== undefined) task.description = data.description;
    if (data.assignedTo !== undefined) task.assignedTo = data.assignedTo;
    if (data.dueDate !== undefined) task.dueDate = data.dueDate;

    // Column / status change -> relocate to end of target column.
    const targetColumnId = data.columnId ?? String(task.columnId);
    let targetColumn = null;
    if (data.columnId || data.status) {
      if (!assertObjectId(targetColumnId))
        return badRequest("Invalid column id");
      targetColumn = await Column.findById(targetColumnId);
      if (!targetColumn) return notFound("Column");
      task.columnId = targetColumn._id;
      task.boardId = targetColumn.boardId;
      task.status = data.status ?? targetColumn.name;
      const max = await Task.find({ columnId: targetColumn._id })
        .sort({ order: -1 })
        .limit(1)
        .select("order")
        .lean();
      // Only bump order when the column actually changed.
      if (String(task.columnId) !== String(targetColumn._id) || data.columnId) {
        task.order = orderForEnd(max[0]?.order ?? null);
      }
    }

    try {
      await task.save();
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === "VersionError") {
        return conflict(
          "This task was modified by someone else. Reload to get the latest version."
        );
      }
      throw err;
    }

    let subtasks = await Subtask.find({ taskId: task._id }).lean();
    if (data.subtasks !== undefined) {
      const existing = await Subtask.find({ taskId: task._id });
      const byId = new Map(existing.map((s) => [String(s._id), s]));
      const keep = new Set(
        data.subtasks.filter((s) => s._id).map((s) => s._id as string)
      );

      await Subtask.deleteMany({
        taskId: task._id,
        _id: { $nin: [...keep].length ? [...keep] : ["000000000000000000000000"] },
      });

      for (const s of data.subtasks) {
        if (s._id && byId.has(s._id)) {
          const doc = byId.get(s._id)!;
          doc.title = s.title;
          doc.isCompleted = s.isCompleted ?? doc.isCompleted;
          await doc.save();
        } else {
          await Subtask.create({
            title: s.title,
            isCompleted: s.isCompleted ?? false,
            taskId: task._id,
            boardId: task.boardId,
          });
        }
      }
      subtasks = await Subtask.find({ taskId: task._id }).lean();
    }

    return NextResponse.json({ task: task.toObject(), subtasks });
  } catch (err) {
    return serverError(err);
  }
}

/** DELETE /api/tasks/:taskId — delete task + its subtasks. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { taskId } = await params;
    if (!assertObjectId(taskId)) return badRequest("Invalid task id");
    await dbConnect();

    const task = await Task.findById(taskId);
    if (!task) return notFound("Task");

    await Subtask.deleteMany({ taskId: task._id });
    await Task.deleteOne({ _id: task._id });

    return NextResponse.json({
      ok: true,
      boardId: task.boardId,
      columnId: task.columnId,
    });
  } catch (err) {
    return serverError(err);
  }
}
