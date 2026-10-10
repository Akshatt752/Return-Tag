import { Router } from "express";
import {
  acceptTransfer,
  cancelTransfer,
  changeStatus,
  claimTag,
  createTag,
  getTag,
  listTags,
  previewTransfer,
  relinkTag,
  startTransfer,
  updateTag,
} from "../controllers/tagController.js";
import { protect } from "../middleware/auth.js";
import { claimLimiter } from "../middleware/rateLimits.js";

const router = Router();

router.use(protect);

// Fixed paths before /:id so "claim" and "transfer" aren't read as ids
router.post("/claim", claimLimiter, claimTag);
router.post("/transfer/accept", acceptTransfer);
// POST so the token travels in the body, never in a URL that ends up in access logs
router.post("/transfer/preview", previewTransfer);

router.get("/", listTags);
router.post("/", createTag);
router.get("/:id", getTag);
router.patch("/:id", updateTag);
router.post("/:id/status", changeStatus);
router.post("/:id/relink", relinkTag);
router.post("/:id/transfer", startTransfer);
router.delete("/:id/transfer", cancelTransfer);

export default router;
