import { Schema, models, model, type InferSchemaType } from "mongoose";

const SubtaskSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Subtask title is required"],
      trim: true,
      maxlength: [120, "Subtask title must be at most 120 characters"],
    },
    isCompleted: { type: Boolean, default: false },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

SubtaskSchema.index({ taskId: 1, _id: 1 });

export type SubtaskDoc = InferSchemaType<typeof SubtaskSchema>;

export const Subtask = models.Subtask || model("Subtask", SubtaskSchema);
