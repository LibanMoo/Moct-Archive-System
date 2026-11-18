import { Router } from "express";
import { listAuditLogs } from "../controllers/auditController.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = Router();
router.get("/", requireAuth, requireAdmin, listAuditLogs);
export default router;
