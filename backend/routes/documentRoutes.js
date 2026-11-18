import { Router } from "express";
import {
  listDocuments, createDocument, getDocument, updateDocument,
  archiveDocument, deleteDocument, downloadDocument, dashboardStats, documentReports
} from "../controllers/documentController.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";
import { uploadDocument } from "../middleware/uploadMiddleware.js";

const router = Router();
router.use(requireAuth);
router.get("/stats", dashboardStats);
router.get("/reports", documentReports);
router.get("/", listDocuments);
router.post("/", (req, res, next) => uploadDocument(req, res, (err) => err ? next(err) : createDocument(req, res, next)));
router.get("/:id/download", downloadDocument);
router.get("/:id", getDocument);
router.patch("/:id", (req, res, next) => uploadDocument(req, res, (err) => err ? next(err) : updateDocument(req, res, next)));
router.delete("/:id", requireAdmin, deleteDocument);
router.patch("/:id/archive", archiveDocument);
export default router;
