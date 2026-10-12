import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { ActivityLog } from "@/models/ActivityLog";
import { Board } from "@/models/Board";
import { activityLogCreateSchema } from "@/lib/validation/schemas";
import {
  assertObjectId,
  badRequest,
  notFound,
  serverError,
  zodError,
} from "@/lib/api-helpers";

type Params = { params: Promise<{ boardId: string }> };

const LOG_LIMIT = 50;

/** GET /api/boards/:boardId/logs — last 50 activity entries, newest first. */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { boardId } = await params;
    if (!assertObjectId(boardId)) return badRequest("Invalid board id");
    await dbConnect();

    const logs = await ActivityLog.find({ boardId })
      .sort({ createdAt: -1 })
      .limit(LOG_LIMIT)
      .lean();
    return NextResponse.json({ logs });
  } catch (err) {
    return serverError(err);
  }
}

/** POST /api/boards/:boardId/logs — record an audit entry. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { boardId } = await params;
    if (!assertObjectId(boardId)) return badRequest("Invalid board id");
    await dbConnect();

    const board = await Board.findById(boardId).select("_id").lean();
    if (!board) return notFound("Board");

    const body = await req.json();
    const parsed = activityLogCreateSchema.safeParse(body);
    if (!parsed.success) return zodError(parsed.error);

    const log = await ActivityLog.create({
      boardId,
      action: parsed.data.action,
      actorName: parsed.data.actorName || "Anonymous",
    });
    return NextResponse.json({ log: log.toObject() }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
