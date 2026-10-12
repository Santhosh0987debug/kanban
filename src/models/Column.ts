import { Schema, models, model, type InferSchemaType } from "mongoose";

const ColumnSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Column name is required"],
      trim: true,
      maxlength: [30, "Column name must be at most 30 characters"],
    },
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    // Fractional-index base. New items use (prev + next) / 2 so
    // drag-and-drop rarely requires rewriting siblings.
    order: { type: Number, required: true, default: 1000 },
  },
  { timestamps: true }
);

ColumnSchema.index({ boardId: 1, order: 1 });

export type ColumnDoc = InferSchemaType<typeof ColumnSchema>;

export const Column = models.Column || model("Column", ColumnSchema);
