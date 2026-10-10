import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./routes/auth.js";
import tagRoutes from "./routes/tags.js";
import reportRoutes from "./routes/reports.js";
import publicRoutes from "./routes/public.js";
import statsRoutes from "./routes/stats.js";
import adminRoutes from "./routes/admin.js";
import pushRoutes from "./routes/push.js";
import { apiLimiter } from "./middleware/rateLimits.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

// Render and Vercel sit behind a proxy; needed so rate limiting and IP hashing see the real client IP
app.set("trust proxy", 1);

app.use(helmet());
// Browsers send the origin without a trailing slash, so normalise whatever was pasted into CLIENT_URL
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, ""));
app.use(cors({ origin: allowedOrigins, allowedHeaders: ["Content-Type", "Authorization", "X-Finder-Token"] }));
app.use(express.json({ limit: "100kb" }));

app.use("/api", apiLimiter);

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/tags", tagRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/push", pushRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
