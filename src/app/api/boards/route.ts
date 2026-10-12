import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongoose";
import { Board } from "@/models/Board";
import { Column } from "@/models/Column";
import { boardCreateSchema } from "@/lib/validation/schemas";
import { serverError, zodError } from "@/lib/api-helpers";
import { ORDER_STEP } from "@/lib/order";

const DEFAULT_COLUMNS = ["Todo", "Doing", "Done"];

/** GET /api/boards — list all boards (sidebar). */
export async function GET() {
  try {
    await dbConnect();
    const boards = await Board.find().sort({ updatedAt: -1 }).lean();
    return NextResponse.json({ boards });
  } catch (err) {
    return serverError(err);
  }
}

/** POST /api/boards — create board + default/custom columns. */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const parsed = boardCreateSchema.safeParse(body);
    if (!parsed.success) return zodError(parsed.error);

    const { name, columns } = parsed.data;
    const names =
      columns && columns.length > 0 ? columns : DEFAULT_COLUMNS;

    const board = await Board.create({ name });
    try {
      const docs = names.map((colName, i) => ({
        name: colName,
        boardId: board._id,
        order: (i + 1) * ORDER_STEP,
      }));
      const created = await Column.insertMany(docs);
      return NextResponse.json({ board, columns: created }, { status: 201 });
    } catch (err) {
      // Roll back the board if column seeding fails (no replica-set txn needed).
      await Board.deleteOne({ _id: board._id }).catch(() => {});
      throw err;
    }
  } catch (err) {
    return serverError(err);
  }
}
