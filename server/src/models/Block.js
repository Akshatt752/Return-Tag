import mongoose from "mongoose";

// Created when an owner marks a report as spam: that sender (by hashed IP) can no
// longer report any of this owner's tags
const blockSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ipHash: { type: String, required: true },
    report: { type: mongoose.Schema.Types.ObjectId, ref: "Report" },
  },
  { timestamps: true }
);

blockSchema.index({ owner: 1, ipHash: 1 }, { unique: true });

export default mongoose.model("Block", blockSchema);
