import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Column } from "@/models/Column";
import { Task } from "@/models/Task";
import { taskMoveSchema } from "@/lib/validation/schemas";
import {
  badRequest,
  conflict,
  notFound,
  serverError,
  zodError,
} from "@/lib/api-helpers";
import {
  needsRenormalize,
  orderBetween,
  renormalizedOrders,
} from "@/lib/order";

/**
 * PUT /api/tasks/move — atomic drag-and-drop persistence.
 * Body: { taskId, toColumnId, toIndex, expectedUpdatedAt? }
 *
 * - Works for reordering within a column and moving across columns.
 * - Uses fractional indexing: order = (prev + next) / 2.
 * - Renormalizes the destination column (1000-step) when neighbours
 *   get too close, keeping ordering stable over many drags.
 * - Keeps `status` in sync with the destination column name.
 */
export async function PUT(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const parsed = taskMoveSchema.safeParse(body);
    if (!parsed.success) return zodError(parsed.error);

    const { taskId, toColumnId, toIndex, expectedUpdatedAt } = parsed.data;

    const task = await Task.findById(taskId);
    if (!task) return notFound("Task");

    if (expectedUpdatedAt) {
      const expected = new Date(expectedUpdatedAt).getTime();
      const current = new Date(task.updatedAt).getTime();
      if (!Number.isNaN(expected) && current > expected + 1000) {
        return conflict(
          "This task was moved by someone else. Reload to get the latest order."
        );
      }
    }

    const destColumn = await Column.findById(toColumnId);
    if (!destColumn) return notFound("Column");

    // Ordered destination siblings, excluding the moving task.
    const siblings = await Task.find({
      columnId: toColumnId,
      _id: { $ne: task._id },
    })
      .sort({ order: 1 })
      .select("_id order")
      .lean();

    const clamped = Math.max(0, Math.min(toIndex, siblings.length));
    const prev = clamped > 0 ? siblings[clamped - 1].order : null;
    const next =
      clamped < siblings.length ? siblings[clamped].order : null;

    if (needsRenormalize(prev, next)) {
      // Renormalize then pick the order at the clamped index.
      const all = await Task.find({
        columnId: toColumnId,
        _id: { $ne: task._id },
      })
        .sort({ order: 1 })
        .select("_id");
      const orders = renormalizedOrders(all.length + 1);
      for (let i = 0; i < all.length; i++) {
        await Task.updateOne({ _id: all[i]._id }, { $set: { order: orders[i >= clamped ? i + 1 : i] } });
      }
      task.order = orders[clamped];
    } else {
      task.order = orderBetween(prev, next);
    }

    task.columnId = destColumn._id;
    task.boardId = destColumn.boardId;
    task.status = destColumn.name;

    try {
      await task.save();
    } catch (err: unknown) {
      if ((err as { name?: string })?.name === "VersionError") {
        return conflict(
          "This task was moved by someone else. Reload to get the latest order."
        );
      }
      throw err;
    }

    return NextResponse.json({
      task: task.toObject(),
      boardId: task.boardId,
    });
  } catch (err) {
    if ((err as Error)?.message?.includes("Invalid")) {
      return badRequest((err as Error).message);
    }
    return serverError(err);
  }
}
