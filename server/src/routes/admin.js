import { Router } from "express";
import {
  adminStats,
  batchTags,
  createBatch,
  flaggedReports,
  listBatches,
  setPlan,
} from "../controllers/adminController.js";
import { protect, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.use(protect, requireAdmin);

router.get("/stats", adminStats);
router.get("/batches", listBatches);
router.post("/batches", createBatch);
router.get("/batches/:id/tags", batchTags);
router.get("/reports", flaggedReports);
router.patch("/users/plan", setPlan);

export default router;
