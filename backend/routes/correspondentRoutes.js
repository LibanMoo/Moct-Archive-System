import { Router } from "express";
import {
  listCorrespondents,
  createCorrespondent,
  updateCorrespondent,
  deleteCorrespondent,
} from "../controllers/correspondentController.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = Router();
router.use(requireAuth);
// Any signed-in user can view and register senders/recipients while recording documents.
router.get("/", listCorrespondents);
router.post("/", createCorrespondent);
// Editing, (de)activating and deleting is for administrators.
router.patch("/:id", requireAdmin, updateCorrespondent);
router.delete("/:id", requireAdmin, deleteCorrespondent);
export default router;
