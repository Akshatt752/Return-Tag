import { Router } from "express";
import { getKey, subscribe, unsubscribe } from "../controllers/pushController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.use(protect);

router.get("/key", getKey);
router.post("/subscribe", subscribe);
router.post("/unsubscribe", unsubscribe);

export default router;
