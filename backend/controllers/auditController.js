import AuditLog from "../models/AuditLog.js";

export async function listAuditLogs(_req, res, next) {
  try {
    const logs = await AuditLog.find().populate("actor", "name email").populate("document", "referenceNumber subject").sort({ createdAt: -1 }).limit(500);
    res.json({ logs });
  } catch (err) { next(err); }
}
