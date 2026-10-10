import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const pushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true },
    keys: { p256dh: String, auth: String },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"], trim: true, maxlength: 60 },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    // Premium removes the free tag limit; set by an admin until payments are wired up
    plan: { type: String, enum: ["free", "premium"], default: "free" },
    notify: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
    },
    pushSubscriptions: { type: [pushSubscriptionSchema], default: [], select: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

// null means unlimited
userSchema.methods.tagLimit = function () {
  if (this.plan === "premium" || this.role === "admin") return null;
  return Number(process.env.FREE_TAG_LIMIT) || 5;
};

export default mongoose.model("User", userSchema);
