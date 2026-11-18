import { Router } from "express";
import { listUsers, createUser, setUserActive, deleteUser } from "../controllers/userController.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = Router();
router.use(requireAuth, requireAdmin);
router.get("/", listUsers);
router.post("/", createUser);
router.patch("/:id/active", setUserActive);
router.delete("/:id", deleteUser);
export default router;
