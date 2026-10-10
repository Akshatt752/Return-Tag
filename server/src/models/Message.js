import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    report: { type: mongoose.Schema.Types.ObjectId, ref: "Report", required: true },
    sender: { type: String, enum: ["owner", "finder", "system"], required: true },
    body: { type: String, required: true, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

messageSchema.index({ report: 1, createdAt: 1 });

export default mongoose.model("Message", messageSchema);
