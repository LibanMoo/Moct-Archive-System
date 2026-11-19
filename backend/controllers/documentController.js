import fs from "fs";
import path from "path";
import crypto from "crypto";
import Document from "../models/Document.js";
import AuditLog from "../models/AuditLog.js";

function makeReference(direction) {
  const date = new Date();
  const year = date.getFullYear();
  const stamp = `${date.getTime().toString().slice(-7)}${crypto.randomInt(10, 99)}`;
  return `${direction}-${year}-${stamp}`;
}

export async function listDocuments(req, res, next) {
  try {
    const { direction, archived, q, status } = req.query;
    const filter = {};
    if (direction && ["IN", "OUT"].includes(direction)) filter.direction = direction;
    if (archived === "true") filter.isArchived = true;
    else if (archived === "false") filter.isArchived = false;
    if (status && ["Pending", "Processing", "Completed"].includes(status)) filter.status = status;
    if (q?.trim()) {
      const safeQ = q.trim().slice(0, 100);
      filter.$or = [
        { subject: { $regex: safeQ, $options: "i" } },
        { referenceNumber: { $regex: safeQ, $options: "i" } },
        { sender: { $regex: safeQ, $options: "i" } },
        { recipient: { $regex: safeQ, $options: "i" } }
      ];
    }
    const documents = await Document.find(filter)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 }).limit(300);
    res.json({ documents });
  } catch (err) { next(err); }
}

export async function createDocument(req, res, next) {
  try {
    const { direction, subject, description = "", sender = "", recipient = "", department = "", documentDate, status = "Pending" } = req.body;
    if (!["IN", "OUT"].includes(direction)) return res.status(400).json({ message: "Direction must be IN or OUT." });
    if (!subject?.trim()) return res.status(400).json({ message: "Subject is required." });
    if (!["Pending", "Processing", "Completed"].includes(status)) return res.status(400).json({ message: "Invalid status." });

    const doc = await Document.create({
      referenceNumber: makeReference(direction), direction, subject: subject.trim(),
      description, sender, recipient, department,
      documentDate: documentDate || new Date(), status,
      createdBy: req.user._id,
      originalFileName: req.file?.originalname || "",
      storedFileName: req.file?.filename || "",
      mimeType: req.file?.mimetype || "",
      fileSize: req.file?.size || 0
    });
    await AuditLog.create({ actor: req.user._id, action: "DOCUMENT_CREATED", document: doc._id, details: `${direction}: ${doc.referenceNumber}`, ipAddress: req.ip });
    res.status(201).json({ document: doc });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    next(err);
  }
}

export async function getDocument(req, res, next) {
  try {
    const doc = await Document.findById(req.params.id).populate("createdBy", "name email").populate("archivedBy", "name email");
    if (!doc) return res.status(404).json({ message: "Document not found." });
    res.json({ document: doc });
  } catch (err) { next(err); }
}

export async function updateDocument(req, res, next) {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found." });
    const allowed = ["subject", "description", "sender", "recipient", "department", "documentDate", "status"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) doc[key] = req.body[key];
    }
    if (req.body.status && !["Pending", "Processing", "Completed"].includes(req.body.status)) {
      return res.status(400).json({ message: "Invalid status." });
    }
    if (req.file) {
      if (doc.storedFileName) fs.unlink(path.resolve("storage", doc.storedFileName), () => {});
      doc.originalFileName = req.file.originalname;
      doc.storedFileName = req.file.filename;
      doc.mimeType = req.file.mimetype;
      doc.fileSize = req.file.size;
    }
    await doc.save();
    await AuditLog.create({ actor: req.user._id, action: "DOCUMENT_UPDATED", document: doc._id, details: doc.referenceNumber, ipAddress: req.ip });
    res.json({ document: doc });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    next(err);
  }
}


export async function deleteDocument(req, res, next) {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found." });

    // Record the deletion before removing the document record.
    await AuditLog.create({
      actor: req.user._id,
      action: "DOCUMENT_DELETED",
      document: doc._id,
      details: `${doc.referenceNumber}: ${doc.subject}`,
      ipAddress: req.ip
    });

    if (doc.storedFileName) {
      const fullPath = path.resolve("storage", path.basename(doc.storedFileName));
      fs.unlink(fullPath, (err) => {
        if (err && err.code !== "ENOENT") console.error("Could not remove document file:", err.message);
      });
    }

    await doc.deleteOne();
    return res.json({ message: "Document deleted successfully.", id: doc._id });
  } catch (err) {
    next(err);
  }
}

export async function archiveDocument(req, res, next) {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found." });
    doc.isArchived = Boolean(req.body.archived);
    doc.archivedAt = doc.isArchived ? new Date() : null;
    doc.archivedBy = doc.isArchived ? req.user._id : null;
    await doc.save();
    await AuditLog.create({ actor: req.user._id, action: doc.isArchived ? "DOCUMENT_ARCHIVED" : "DOCUMENT_UNARCHIVED", document: doc._id, details: doc.referenceNumber, ipAddress: req.ip });
    res.json({ document: doc });
  } catch (err) { next(err); }
}

export async function downloadDocument(req, res, next) {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc || !doc.storedFileName) return res.status(404).json({ message: "No file attached to this document." });
    const fullPath = path.resolve("storage", doc.storedFileName);
    if (!fs.existsSync(fullPath)) return res.status(404).json({ message: "Stored file was not found." });
    await AuditLog.create({ actor: req.user._id, action: "DOCUMENT_DOWNLOADED", document: doc._id, details: doc.referenceNumber, ipAddress: req.ip });
    res.download(fullPath, path.basename(doc.originalFileName || "document"));
  } catch (err) { next(err); }
}

export async function dashboardStats(_req, res, next) {
  try {
    const [total, incoming, outgoing, pending, archived] = await Promise.all([
      Document.countDocuments({ isArchived: false }),
      Document.countDocuments({ direction: "IN", isArchived: false }),
      Document.countDocuments({ direction: "OUT", isArchived: false }),
      Document.countDocuments({ status: "Pending", isArchived: false }),
      Document.countDocuments({ isArchived: true })
    ]);
    const recent = await Document.find().sort({ createdAt: -1 }).limit(8).select("referenceNumber direction subject status isArchived createdAt");
    res.json({ stats: { total, incoming, outgoing, pending, archived }, recent });
  } catch (err) { next(err); }
}

const REPORT_PERIODS = { daily: "daily", monthly: "monthly", annual: "annual", yearly: "annual" };

// Builds the exact [start, end) UTC range for a report. Document dates are stored
// as UTC midnight (date-only input), so UTC boundaries keep the filter exact.
function buildReportRange(query) {
  const period = REPORT_PERIODS[String(query.period || query.type || "daily").toLowerCase()];
  if (!period) return { error: "Invalid report period. Use daily, monthly or annual." };

  const now = new Date();
  if (period === "daily") {
    const dateValue = String(query.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return { error: "A valid report date is required (YYYY-MM-DD)." };
    const [y, m, d] = dateValue.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    if (start.getUTCFullYear() !== y || start.getUTCMonth() !== m - 1 || start.getUTCDate() !== d) return { error: "Invalid report date." };
    return { period, start, end: new Date(Date.UTC(y, m - 1, d + 1)), params: { date: dateValue } };
  }

  const year = Number(query.year ?? now.getUTCFullYear());
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { error: "Invalid report year." };
  if (period === "annual") {
    return { period, start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1)), params: { year } };
  }
  const month = Number(query.month ?? now.getUTCMonth() + 1);
  if (!Number.isInteger(month) || month < 1 || month > 12) return { error: "Invalid report month." };
  return { period, start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 1)), params: { year, month } };
}

// One endpoint serves all six reports: IN/OUT x daily/monthly/annual.
export async function documentReports(req, res, next) {
  try {
    const direction = String(req.query.direction || "").toUpperCase();
    if (!["IN", "OUT"].includes(direction)) return res.status(400).json({ message: "Report direction must be IN or OUT." });

    const range = buildReportRange(req.query);
    if (range.error) return res.status(400).json({ message: range.error });

    const documents = await Document.find({ direction, documentDate: { $gte: range.start, $lt: range.end } })
      .sort({ documentDate: 1, createdAt: 1 })
      .select("referenceNumber subject documentDate sender recipient department status isArchived")
      .lean();

    const count = status => documents.filter(doc => doc.status === status).length;
    const summary = {
      total: documents.length,
      pending: count("Pending"),
      processing: count("Processing"),
      completed: count("Completed"),
      archived: documents.filter(doc => doc.isArchived).length
    };
    res.json({ direction, period: range.period, ...range.params, summary, documents });
  } catch (err) { next(err); }
}
