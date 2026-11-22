import { db } from "../config/db.js";

const AuditLog = db.orm.public.AuditLog;

export async function listAuditLogs(_req, res, next) {
  try {
    const rows = await AuditLog.include("user", (u) =>
      u.select("id", "name", "email"),
    )
      .include("document", (d) => d.select("id", "referenceNumber"))
      .orderBy((l) => l.timestamp.desc())
      .limit(500)
      .all();

    // Shape kept compatible with the frontend (actor / document / createdAt).
    const logs = rows.map((log) => ({
      id: log.id,
      action: log.action,
      details: log.details ?? "",
      ipAddress: log.ipAddress ?? "",
      createdAt: log.timestamp,
      actor: log.user,
      document: log.document,
    }));

    res.json({ logs });
  } catch (err) {
    next(err);
  }
}
