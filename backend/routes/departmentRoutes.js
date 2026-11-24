import { Router } from "express";
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../controllers/departmentController.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = Router();
router.use(requireAuth);
// Any signed-in user can list and add departments while registering documents.
router.get("/", listDepartments);
router.post("/", createDepartment);
router.patch("/:id", requireAdmin, updateDepartment);
router.delete("/:id", requireAdmin, deleteDepartment);
export default router;
