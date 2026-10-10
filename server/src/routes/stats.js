import { Router } from "express";
import { myStats, publicStats } from "../controllers/statsController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/public", publicStats);
router.get("/me", protect, myStats);

export default router;
