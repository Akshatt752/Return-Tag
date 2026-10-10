import mongoose from "mongoose";

// Finder photos are small re-encoded JPEGs (EXIF stripped), stored in MongoDB so only
// the report's owner can fetch them and they're deleted with the report's other data
const photoSchema = new mongoose.Schema(
  {
    report: { type: mongoose.Schema.Types.ObjectId, ref: "Report", required: true, unique: true },
    data: { type: Buffer, required: true },
    contentType: { type: String, default: "image/jpeg" },
  },
  { timestamps: true }
);

export default mongoose.model("Photo", photoSchema);
