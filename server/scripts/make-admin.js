// Gives an existing account the admin role.
// Usage: npm run make-admin -- you@example.com
import "../src/config/env.js";
import mongoose from "mongoose";
import User from "../src/models/User.js";

const email = process.argv[2]?.toLowerCase().trim();
if (!email) {
  console.error("Usage: npm run make-admin -- you@example.com");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const user = await User.findOne({ email });

if (!user) {
  console.error(`No account with ${email}. Register in the app first, then run this again.`);
  process.exitCode = 1;
} else {
  user.role = "admin";
  await user.save();
  console.log(`${email} is now an admin.`);
}

await mongoose.disconnect();
