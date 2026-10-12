import { Schema, models, model, type InferSchemaType } from "mongoose";

const TaskSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [120, "Title must be at most 120 characters"],
    },
    description: {
      type: String,
      default: "",
      maxlength: [2000, "Description must be at most 2000 characters"],
    },
    // Denormalized Column.name for instant status dropdown + optimistic UI.
    // Must be kept in sync with columnId on moves/renames.
    status: { type: String, required: true, trim: true },
    columnId: {
      type: Schema.Types.ObjectId,
      ref: "Column",
      required: true,
      index: true,
    },
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    order: { type: Number, required: true, default: 1000 },
    assignedTo: {
      type: String,
      default: "",
      trim: true,
      maxlength: [60, "Assignee must be at most 60 characters"],
    },
    dueDate: { type: Date, default: null },
  },
  {
    timestamps: true,
    // Throws VersionError on concurrent saves -> used for edit conflicts.
    optimisticConcurrency: true,
  }
);

TaskSchema.index({ columnId: 1, order: 1 });
TaskSchema.index({ boardId: 1, updatedAt: -1 });

export type TaskDoc = InferSchemaType<typeof TaskSchema>;

export const Task = models.Task || model("Task", TaskSchema);
