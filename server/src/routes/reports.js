import { Router } from "express";
import { getPhoto, getReport, listReports, postOwnerMessage, updateReport } from "../controllers/reportController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.get("/", listReports);
router.get("/:id", getReport);
router.patch("/:id", updateReport);
router.post("/:id/messages", postOwnerMessage);
router.get("/:id/photo", getPhoto);

export default router;
