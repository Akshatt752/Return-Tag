import mongoose from "mongoose";

// A run of pre-printed tags for a school, business or partner brand
const tagBatchSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Batch name is required"], trim: true, maxlength: 80 },
    organization: { type: String, trim: true, maxlength: 80, default: "" },
    count: { type: Number, required: true, min: 1, max: 500 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("TagBatch", tagBatchSchema);
