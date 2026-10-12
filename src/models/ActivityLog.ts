import { Schema, models, model, type InferSchemaType } from "mongoose";

const ActivityLogSchema = new Schema(
  {
    boardId: {
      type: Schema.Types.ObjectId,
      ref: "Board",
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: [true, "Action is required"],
      trim: true,
      maxlength: [200, "Action must be at most 200 characters"],
    },
    actorName: {
      type: String,
      default: "Anonymous",
      trim: true,
      maxlength: [60, "Actor name must be at most 60 characters"],
    },
  },
  { timestamps: true }
);

ActivityLogSchema.index({ boardId: 1, createdAt: -1 });

export type ActivityLogDoc = InferSchemaType<typeof ActivityLogSchema>;

export const ActivityLog =
  models.ActivityLog || model("ActivityLog", ActivityLogSchema);
