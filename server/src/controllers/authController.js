import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { httpError } from "../middleware/errorHandler.js";
import { email, str } from "../utils/validate.js";
import { serializeUser } from "../utils/serialize.js";

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

// Accounts listed in ADMIN_EMAILS (comma-separated) become admins when they register or log in
function isListedAdmin(address) {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .includes(address);
}

// Passwords aren't trimmed: spaces are allowed characters
function readPassword(value) {
  if (typeof value !== "string" || !value) throw httpError(400, "Password is required");
  if (value.length > 200) throw httpError(400, "Password is too long");
  return value;
}

export async function register(req, res) {
  const body = req.body ?? {};
  const name = str(body.name, "name", { required: true, max: 60 });
  const address = email(body.email, "email", { required: true });
  const password = readPassword(body.password);
  if (password.length < 8) throw httpError(400, "Password must be at least 8 characters");

  const role = isListedAdmin(address) ? "admin" : "user";
  const user = await User.create({ name, email: address, password, role });
  res.status(201).json({ token: signToken(user._id), user: serializeUser(user) });
}

export async function login(req, res) {
  const body = req.body ?? {};
  const address = email(body.email, "email", { required: true });
  const password = readPassword(body.password);

  const user = await User.findOne({ email: address }).select("+password");
  if (!user || !(await user.matchPassword(password))) {
    throw httpError(401, "Invalid email or password");
  }
  if (user.role !== "admin" && isListedAdmin(user.email)) {
    user.role = "admin";
    await user.save();
  }

  res.json({ token: signToken(user._id), user: serializeUser(user) });
}

export async function me(req, res) {
  res.json({ user: serializeUser(req.user) });
}

export async function updateMe(req, res) {
  const body = req.body ?? {};
  const user = req.user;

  if (body.name !== undefined) user.name = str(body.name, "name", { required: true, max: 60 });
  if (body.notify !== undefined) {
    if (typeof body.notify !== "object" || body.notify === null) throw httpError(400, "Notify must be an object");
    for (const channel of ["email", "push"]) {
      const value = body.notify[channel];
      if (value === undefined) continue;
      if (typeof value !== "boolean") throw httpError(400, `notify.${channel} must be true or false`);
      user.notify[channel] = value;
    }
  }

  await user.save();
  res.json({ user: serializeUser(user) });
}
