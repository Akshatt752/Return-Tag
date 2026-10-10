import mongoose from "mongoose";

export const CATEGORIES = ["bag", "laptop", "phone", "keys", "wallet", "luggage", "headphones", "bike", "other"];
export const STATUSES = ["unclaimed", "active", "lost", "found", "returned", "disabled"];

const { ObjectId } = mongoose.Schema.Types;

const tagSchema = new mongoose.Schema(
  {
    // Printed in the QR code and on the sticker. Never changes, never reveals the owner.
    code: { type: String, required: true, unique: true },
    owner: { type: ObjectId, ref: "User", default: null, index: true },
    // Pre-printed (bulk) tags are activated with a second secret code from the packaging
    claimCodeHash: { type: String, select: false },
    batch: { type: ObjectId, ref: "TagBatch", default: null, index: true },

    // Private: only the owner sees these
    item: {
      name: { type: String, trim: true, maxlength: 80, default: "" },
      category: { type: String, enum: CATEGORIES, default: "other" },
      description: { type: String, trim: true, maxlength: 500, default: "" },
    },
    // Public: what a finder sees after scanning
    publicLabel: { type: String, trim: true, maxlength: 60, default: "" },
    publicMessage: { type: String, trim: true, maxlength: 280, default: "" },
    rewardOffered: { type: Boolean, default: false },

    status: { type: String, enum: STATUSES, default: "active", index: true },
    lostAt: { type: Date, default: null },
    foundAt: { type: Date, default: null },
    returnedAt: { type: Date, default: null },

    // Only a count: we never record who scanned or where
    scanCount: { type: Number, default: 0 },
    lastScannedAt: { type: Date, default: null },

    transfer: {
      toEmail: { type: String, default: null },
      expiresAt: { type: Date, default: null },
      tokenHash: { type: String, default: null, select: false },
    },
    history: {
      type: [
        {
          _id: false,
          owner: { type: ObjectId, ref: "User" },
          reason: { type: String, enum: ["created", "claimed", "transferred", "relinked"] },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
      select: false,
    },
  },
  { timestamps: true }
);

tagSchema.index({ "transfer.tokenHash": 1 });

export default mongoose.model("Tag", tagSchema);
