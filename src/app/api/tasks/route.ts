import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Column } from "@/models/Column";
import { Task } from "@/models/Task";
import { Subtask } from "@/models/Subtask";
import { taskCreateSchema } from "@/lib/validation/schemas";
import {
  assertObjectId,
  badRequest,
  notFound,
  serverError,
  zodError,
} from "@/lib/api-helpers";
import { orderForEnd } from "@/lib/order";

/** POST /api/tasks — create task + subtasks under a column. */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const parsed = taskCreateSchema.safeParse(body);
    if (!parsed.success) return zodError(parsed.error);

    const {
      title,
      description,
      columnId,
      boardId,
      status,
      order,
      assignedTo,
      dueDate,
      subtasks,
    } = parsed.data;

    if (!assertObjectId(columnId)) return badRequest("Invalid column id");
    const column = await Column.findById(columnId);
    if (!column) return notFound("Column");

    const resolvedBoardId = boardId ?? String(column.boardId);
    const resolvedStatus = status ?? column.name;

    const resolvedOrder =
      order ??
      orderForEnd(
        (await Task.find({ columnId })
          .sort({ order: -1 })
          .limit(1)
          .select("order")
          .lean())?.[0]?.order ?? null
      );

    const task = await Task.create({
      title,
      description: description ?? "",
      status: resolvedStatus,
      columnId,
      boardId: resolvedBoardId,
      order: resolvedOrder,
      assignedTo: assignedTo ?? "",
      dueDate: dueDate ?? null,
    });

    const createdSubtasks =
      subtasks.length > 0
        ? await Subtask.insertMany(
            subtasks.map((s) => ({
              title: s.title,
              isCompleted: s.isCompleted ?? false,
              taskId: task._id,
              boardId: resolvedBoardId,
            }))
          )
        : [];

    return NextResponse.json(
      { task: task.toObject(), subtasks: createdSubtasks },
      { status: 201 }
    );
  } catch (err) {
    return serverError(err);
  }
}
