import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Board } from "@/models/Board";
import { Column } from "@/models/Column";
import { Task } from "@/models/Task";
import { Subtask } from "@/models/Subtask";
import { boardUpdateSchema } from "@/lib/validation/schemas";
import {
  assertObjectId,
  badRequest,
  notFound,
  serverError,
  zodError,
} from "@/lib/api-helpers";
import { ORDER_STEP } from "@/lib/order";

type Params = { params: Promise<{ boardId: string }> };

/** GET /api/boards/:boardId — full board with columns, tasks, subtasks. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { boardId } = await params;
    if (!assertObjectId(boardId)) return badRequest("Invalid board id");
    await dbConnect();

    const board = await Board.findById(boardId).lean();
    if (!board) return notFound("Board");

    const columns = await Column.find({ boardId }).sort({ order: 1 }).lean();
    const tasks = await Task.find({ boardId }).sort({ order: 1 }).lean();
    const taskIds = tasks.map((t) => t._id);
    const subtasks = taskIds.length
      ? await Subtask.find({ taskId: { $in: taskIds } }).lean()
      : [];

    const subtasksByTask = new Map<string, typeof subtasks>();
    for (const s of subtasks) {
      const key = String(s.taskId);
      if (!subtasksByTask.has(key)) subtasksByTask.set(key, []);
      subtasksByTask.get(key)!.push(s);
    }

    const tasksWithSubtasks = tasks.map((t) => ({
      ...t,
      subtasks: subtasksByTask.get(String(t._id)) ?? [],
    }));

    return NextResponse.json({ board, columns, tasks: tasksWithSubtasks });
  } catch (err) {
    return serverError(err);
  }
}

/** PUT /api/boards/:boardId — rename board and/or sync columns. */
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const { boardId } = await params;
    if (!assertObjectId(boardId)) return badRequest("Invalid board id");
    await dbConnect();

    const body = await req.json();
    const parsed = boardUpdateSchema.safeParse(body);
    if (!parsed.success) return zodError(parsed.error);

    const board = await Board.findById(boardId);
    if (!board) return notFound("Board");

    if (parsed.data.name !== undefined) {
      board.name = parsed.data.name;
      await board.save();
    }

    let columns;
    if (parsed.data.columns !== undefined) {
      columns = await syncColumns(boardId, parsed.data.columns);
    } else {
      columns = await Column.find({ boardId }).sort({ order: 1 }).lean();
    }

    return NextResponse.json({ board: board.toObject(), columns });
  } catch (err) {
    return serverError(err);
  }
}

/** DELETE /api/boards/:boardId — cascade delete everything. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { boardId } = await params;
    if (!assertObjectId(boardId)) return badRequest("Invalid board id");
    await dbConnect();

    const board = await Board.findById(boardId);
    if (!board) return notFound("Board");

    const cols = await Column.find({ boardId }).select("_id").lean();
    const colIds = cols.map((c) => c._id);
    const tasks = colIds.length
      ? await Task.find({ columnId: { $in: colIds } }).select("_id").lean()
      : [];
    const taskIds = tasks.map((t) => t._id);

    if (taskIds.length) await Subtask.deleteMany({ taskId: { $in: taskIds } });
    await Task.deleteMany({ boardId });
    await Column.deleteMany({ boardId });
    await Board.deleteOne({ _id: boardId });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err);
  }
}

// ---------------------------------------------------------------------------

async function syncColumns(
  boardId: string,
  incoming: { _id?: string; name: string }[]
) {
  const existing = await Column.find({ boardId }).sort({ order: 1 });
  const existingById = new Map(existing.map((c) => [String(c._id), c]));
  const keepIds = new Set(
    incoming.filter((c) => c._id).map((c) => c._id as string)
  );

  // Delete removed columns + their tasks/subtasks.
  const toDelete = existing.filter((c) => !keepIds.has(String(c._id)));
  for (const col of toDelete) {
    const tasks = await Task.find({ columnId: col._id }).select("_id").lean();
    const tids = tasks.map((t) => t._id);
    if (tids.length) await Subtask.deleteMany({ taskId: { $in: tids } });
    await Task.deleteMany({ columnId: col._id });
    await Column.deleteOne({ _id: col._id });
  }

  // Rename kept columns and keep Task.status in sync.
  for (const item of incoming) {
    if (item._id && existingById.has(item._id)) {
      const col = existingById.get(item._id)!;
      if (col.name !== item.name) {
        const oldName = col.name;
        col.name = item.name;
        await col.save();
        await Task.updateMany(
          { columnId: col._id, status: oldName },
          { $set: { status: item.name } }
        );
      }
    }
  }

  // Append brand-new columns at the end.
  const maxOrder = existing.length
    ? Math.max(...existing.map((c) => c.order))
    : 0;
  let next = maxOrder > 0 ? maxOrder : ORDER_STEP;
  for (const item of incoming) {
    if (!item._id) {
      next += 1000;
      await Column.create({ name: item.name, boardId, order: next });
    }
  }

  return Column.find({ boardId }).sort({ order: 1 }).lean();
}
