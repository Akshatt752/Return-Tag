import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

// A finder's report about a tag. It is also the anonymous conversation between finder and owner.
const reportSchema = new mongoose.Schema(
  {
    tag: { type: ObjectId, ref: "Tag", required: true, index: true },
    // The owner at the time of the report. If the tag is later transferred, the
    // conversation stays with this person and the new owner never sees it.
    owner: { type: ObjectId, ref: "User", required: true, index: true },
    incident: { type: ObjectId, ref: "Incident", default: null },
    // What the finder saw when they scanned, kept even if the tag is relinked later
    tagSnapshot: {
      code: String,
      publicLabel: String,
      category: String,
    },

    alias: { type: String, trim: true, maxlength: 40, default: "Finder" },
    location: {
      type: {
        _id: false,
        text: { type: String, default: "" },
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        precision: { type: String, enum: ["approx", "exact"], default: "approx" },
      },
      default: null,
    },
    hasPhoto: { type: Boolean, default: false },

    // Finder secrets: never sent to the owner
    finderTokenHash: { type: String, required: true, select: false },
    finderEmailEnc: { type: String, default: null, select: false },
    // Kept (encrypted) only when the finder left an email, so reply notifications can include their link
    finderTokenEnc: { type: String, default: null, select: false },
    ipHash: { type: String, default: null, select: false, index: true },

    status: { type: String, enum: ["open", "resolved", "spam"], default: "open", index: true },
    ownerUnread: { type: Number, default: 1 },
    finderUnread: { type: Number, default: 0 },
    // Opening message excerpt (for admin spam review); lastExcerpt follows the conversation
    summary: { type: String, default: "" },
    lastExcerpt: { type: String, default: "" },
    lastMessageAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    // Set when location, photo and finder contact details were deleted after the retention period
    purgedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reportSchema.index({ tag: 1, createdAt: -1 });
reportSchema.index({ ipHash: 1, createdAt: -1 });

export default mongoose.model("Report", reportSchema);
