import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// One lost → recovered cycle of a tag. Recovery statistics are computed from these.
const incidentSchema = new mongoose.Schema(
  {
    tag: { type: ObjectId, ref: "Tag", required: true, index: true },
    owner: { type: ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["open", "recovered", "cancelled"], default: "open", index: true },
    // "finder" when someone reported the item before the owner noticed it was gone
    startedBy: { type: String, enum: ["owner", "finder"], required: true },
    lostAt: { type: Date, default: null },
    foundAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Incident", incidentSchema);
