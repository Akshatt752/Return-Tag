import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function protect(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Please log in to continue" });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: "Session expired, please log in again" });
  }

  const user = await User.findById(payload.id);
  if (!user) {
    return res.status(401).json({ message: "Account no longer exists" });
  }

  req.user = user;
  next();
}

// Use after protect
export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admins only" });
  }
  next();
}
