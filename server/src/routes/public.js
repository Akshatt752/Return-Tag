import { Router } from "express";
import { createReport, getFinderReport, getPublicTag, postFinderMessage } from "../controllers/publicController.js";
import { finderMessageLimiter, finderReadLimiter, reportLimiter, scanLimiter } from "../middleware/rateLimits.js";
import { photoUpload } from "../middleware/upload.js";

// Finder routes: no account needed
const router = Router();

router.get("/tags/:code", scanLimiter, getPublicTag);
router.post("/tags/:code/reports", reportLimiter, photoUpload, createReport);
router.get("/reports/:id", finderReadLimiter, getFinderReport);
router.post("/reports/:id/messages", finderMessageLimiter, postFinderMessage);

export default router;
