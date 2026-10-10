import { Router } from "express";
import { register, login, me, updateMe } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimits.js";

const router = Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.get("/me", protect, me);
router.patch("/me", protect, updateMe);

export default router;
