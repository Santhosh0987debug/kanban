import { Schema, models, model, type InferSchemaType } from "mongoose";

const BoardSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Board name is required"],
      trim: true,
      maxlength: [60, "Board name must be at most 60 characters"],
    },
  },
  { timestamps: true }
);

BoardSchema.index({ updatedAt: -1 });

export type BoardDoc = InferSchemaType<typeof BoardSchema> & {
  _id: Schema.Types.ObjectId;
};

export const Board = models.Board || model("Board", BoardSchema);
