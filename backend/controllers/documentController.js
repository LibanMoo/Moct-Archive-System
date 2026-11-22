import fs from "fs";
import path from "path";
import crypto from "crypto";

import { or } from "@prisma/orm-postgres/orm-client";
import { db } from "../config/db.js";

const Document = db.orm.public.Document;
const AuditLog = db.orm.public.AuditLog;

const DIRECTIONS = ["IN", "OUT"];
const STATUSES = ["Pending", "Processing", "Completed"];

function makeReference(direction) {
  const date = new Date();
  const year = date.getFullYear();
  const stamp = `${date.getTime().toString().slice(-7)}${crypto.randomInt(10, 99)}`;

  return `${direction}-${year}-${stamp}`;
}

function safeUnlink(filePath) {
  if (!filePath) return;

  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("Could not remove file:", err.message);
    }
  });
}

async function createAudit(tx, req, data) {
  return tx.orm.public.AuditLog.create({
    userId: req.user.id,
    action: data.action,
    documentId: data.documentId ?? null,
    details: data.details ?? "",
    ipAddress: req.ip,
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Resolve a sender/recipient id from the request.
// Returns undefined when not sent, null when cleared, the row when found,
// or throws a 400 error when the id is unknown.
async function resolveCorrespondent(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const row = UUID_RE.test(String(value))
    ? await db.orm.public.Correspondent.select("id", "name")
        .where({ id: String(value) })
        .first()
    : null;

  if (!row) {
    const err = new Error("Selected sender/recipient does not exist.");
    err.status = 400;
    throw err;
  }
  return row;
}

// Applies senderId/recipientId from the body onto `data` (id + name snapshot).
async function applyCorrespondents(body, data) {
  const sender = await resolveCorrespondent(body.senderId);
  if (sender !== undefined) {
    data.senderId = sender?.id ?? null;
    data.sender = sender?.name ?? null;
  }
  const recipient = await resolveCorrespondent(body.recipientId);
  if (recipient !== undefined) {
    data.recipientId = recipient?.id ?? null;
    data.recipient = recipient?.name ?? null;
  }
}

// null = not provided, undefined = invalid, Date = valid
function parseDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// GET /documents
export async function listDocuments(req, res, next) {
  try {
    const { direction, archived, q, status, correspondentId } = req.query;

    let query = Document;

    if (DIRECTIONS.includes(direction)) {
      query = query.where({ direction });
    }

    if (archived === "true") {
      query = query.where({ isArchived: true });
    } else if (archived === "false") {
      query = query.where({ isArchived: false });
    }

    if (STATUSES.includes(status)) {
      query = query.where({ status });
    }

    // Documents sent by OR received by this correspondent.
    if (typeof correspondentId === "string" && UUID_RE.test(correspondentId)) {
      query = query.where((d) =>
        or(d.senderId.eq(correspondentId), d.recipientId.eq(correspondentId)),
      );
    }

    if (typeof q === "string" && q.trim()) {
      const search = `%${q.trim().slice(0, 100)}%`;

      query = query.where((d) =>
        or(
          d.subject.ilike(search),
          d.referenceNumber.ilike(search),
          d.sender.ilike(search),
          d.recipient.ilike(search),
        ),
      );
    }

    const documents = await query
      .include("createdBy", (user) => user.select("id", "name", "email"))
      .orderBy((d) => d.createdAt.desc())
      .limit(300)
      .all();

    res.json({ documents });
  } catch (err) {
    next(err);
  }
}

// POST /documents
export async function createDocument(req, res, next) {
  try {
    const {
      direction,
      subject,
      description = "",
      sender = "",
      recipient = "",
      department = "",
      documentDate,
      status = "Pending",
    } = req.body;

    let validationError = null;

    if (!DIRECTIONS.includes(direction)) {
      validationError = "Direction must be IN or OUT.";
    } else if (typeof subject !== "string" || !subject.trim()) {
      validationError = "Subject is required.";
    } else if (!STATUSES.includes(status)) {
      validationError = "Invalid status.";
    } else if (parseDate(documentDate) === undefined) {
      validationError = "Invalid document date.";
    }

    if (validationError) {
      if (req.file?.path) safeUnlink(req.file.path);
      return res.status(400).json({ message: validationError });
    }

    const documentData = {
      referenceNumber: makeReference(direction),
      direction,
      subject: subject.trim(),
      description,
      sender: sender || null,
      recipient: recipient || null,
      department,
      documentDate: parseDate(documentDate) ?? new Date(),
      status,
      createdById: req.user.id,
      updatedById: req.user.id,
      originalFileName: req.file?.originalname || null,
      storedFileName: req.file?.filename || null,
      mimeType: req.file?.mimetype || null,
      fileSize: req.file?.size || 0,
      isArchived: false,
    };

    await applyCorrespondents(req.body, documentData);

    const document = await db.transaction(async (tx) => {
      const created = await tx.orm.public.Document.create(documentData);

      await createAudit(tx, req, {
        action: "DOCUMENT_CREATED",
        documentId: created.id,
        details: `${direction}: ${created.referenceNumber}`,
      });

      return created;
    });

    res.status(201).json({ document });
  } catch (err) {
    if (req.file?.path) safeUnlink(req.file.path);
    next(err);
  }
}

// GET /documents/:id
export async function getDocument(req, res, next) {
  try {
    const document = await Document.where({ id: req.params.id })
      .include("createdBy", (user) => user.select("id", "name", "email"))
      .include("archivedBy", (user) => user.select("id", "name", "email"))
      .first();

    if (!document) {
      return res.status(404).json({
        message: "Document not found.",
      });
    }

    res.json({ document });
  } catch (err) {
    next(err);
  }
}

// PUT /documents/:id
export async function updateDocument(req, res, next) {
  try {
    const existing = await Document.where({ id: req.params.id }).first();

    if (!existing) {
      if (req.file?.path) safeUnlink(req.file.path);

      return res.status(404).json({
        message: "Document not found.",
      });
    }

    const allowed = [
      "subject",
      "description",
      "sender",
      "recipient",
      "department",
      "documentDate",
      "status",
    ];

    if (req.body.status !== undefined && !STATUSES.includes(req.body.status)) {
      if (req.file?.path) safeUnlink(req.file.path);

      return res.status(400).json({
        message: "Invalid status.",
      });
    }

    const updateData = { updatedById: req.user.id };

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updateData[key] = req.body[key];
      }
    }

    if (updateData.documentDate !== undefined) {
      const date = parseDate(updateData.documentDate);
      if (!date) {
        if (req.file?.path) safeUnlink(req.file.path);
        return res.status(400).json({ message: "Invalid document date." });
      }
      updateData.documentDate = date;
    }

    if (updateData.subject !== undefined && !String(updateData.subject).trim()) {
      if (req.file?.path) safeUnlink(req.file.path);
      return res.status(400).json({ message: "Subject is required." });
    }

    await applyCorrespondents(req.body, updateData);

    if (req.file) {
      updateData.originalFileName = req.file.originalname;
      updateData.storedFileName = req.file.filename;
      updateData.mimeType = req.file.mimetype;
      updateData.fileSize = req.file.size;
    }

    const document = await db.transaction(async (tx) => {
      const updated = await tx.orm.public.Document.where({
        id: req.params.id,
      }).update(updateData);

      await createAudit(tx, req, {
        action: "DOCUMENT_UPDATED",
        documentId: existing.id,
        details: existing.referenceNumber,
      });

      return updated;
    });

    // Remove the old file only after the database update succeeds.
    if (req.file && existing.storedFileName) {
      safeUnlink(
        path.resolve("storage", path.basename(existing.storedFileName)),
      );
    }

    res.json({ document });
  } catch (err) {
    if (req.file?.path) safeUnlink(req.file.path);
    next(err);
  }
}

// DELETE /documents/:id
export async function deleteDocument(req, res, next) {
  try {
    const document = await Document.where({ id: req.params.id }).first();

    if (!document) {
      return res.status(404).json({
        message: "Document not found.",
      });
    }

    await db.transaction(async (tx) => {
      await createAudit(tx, req, {
        action: "DOCUMENT_DELETED",
        documentId: document.id,
        details: `${document.referenceNumber}: ${document.subject}`,
      });

      await tx.orm.public.Document.where({ id: document.id }).delete();
    });

    if (document.storedFileName) {
      safeUnlink(
        path.resolve("storage", path.basename(document.storedFileName)),
      );
    }

    res.json({
      message: "Document deleted successfully.",
      id: document.id,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /documents/:id/archive
export async function archiveDocument(req, res, next) {
  try {
    const existing = await Document.where({ id: req.params.id }).first();

    if (!existing) {
      return res.status(404).json({
        message: "Document not found.",
      });
    }

    if (typeof req.body.archived !== "boolean") {
      return res.status(400).json({
        message: "The archived field must be true or false.",
      });
    }

    const archived = req.body.archived;

    const document = await db.transaction(async (tx) => {
      const updated = await tx.orm.public.Document.where({
        id: existing.id,
      }).update({
        isArchived: archived,
        archivedAt: archived ? new Date() : null,
        archivedById: archived ? req.user.id : null,
        updatedById: req.user.id,
      });

      await createAudit(tx, req, {
        action: archived ? "DOCUMENT_ARCHIVED" : "DOCUMENT_UNARCHIVED",
        documentId: existing.id,
        details: existing.referenceNumber,
      });

      return updated;
    });

    res.json({ document });
  } catch (err) {
    next(err);
  }
}

// GET /documents/:id/download
export async function downloadDocument(req, res, next) {
  try {
    const document = await Document.where({ id: req.params.id }).first();

    if (!document || !document.storedFileName) {
      return res.status(404).json({
        message: "No file attached to this document.",
      });
    }

    const fullPath = path.resolve(
      "storage",
      path.basename(document.storedFileName),
    );

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({
        message: "Stored file was not found.",
      });
    }

    await AuditLog.create({
      userId: req.user.id,
      action: "DOCUMENT_DOWNLOADED",
      documentId: document.id,
      details: document.referenceNumber,
      ipAddress: req.ip,
    });

    res.download(
      fullPath,
      path.basename(document.originalFileName || "document"),
    );
  } catch (err) {
    next(err);
  }
}

// GET /documents/dashboard/stats
export async function dashboardStats(_req, res, next) {
  try {
    const [
      totalResult,
      incomingResult,
      outgoingResult,
      pendingResult,
      archivedResult,
      recent,
    ] = await Promise.all([
      Document.where({ isArchived: false }).aggregate((a) => ({
        count: a.count(),
      })),

      Document.where({ direction: "IN", isArchived: false }).aggregate((a) => ({
        count: a.count(),
      })),

      Document.where({ direction: "OUT", isArchived: false }).aggregate(
        (a) => ({ count: a.count() }),
      ),

      Document.where({ status: "Pending", isArchived: false }).aggregate(
        (a) => ({ count: a.count() }),
      ),

      Document.where({ isArchived: true }).aggregate((a) => ({
        count: a.count(),
      })),

      Document.select(
        "id",
        "referenceNumber",
        "direction",
        "subject",
        "status",
        "isArchived",
        "createdAt",
      )
        .orderBy((d) => d.createdAt.desc())
        .limit(8)
        .all(),
    ]);

    res.json({
      stats: {
        total: totalResult.count,
        incoming: incomingResult.count,
        outgoing: outgoingResult.count,
        pending: pendingResult.count,
        archived: archivedResult.count,
      },
      recent,
    });
  } catch (err) {
    next(err);
  }
}

// Report periods
const REPORT_PERIODS = {
  daily: "daily",
  monthly: "monthly",
  annual: "annual",
  yearly: "annual",
};

function buildReportRange(query) {
  const period =
    REPORT_PERIODS[String(query.period || query.type || "daily").toLowerCase()];

  if (!period) {
    return {
      error: "Invalid report period. Use daily, monthly or annual.",
    };
  }

  const now = new Date();

  if (period === "daily") {
    const dateValue = String(query.date || "");

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return {
        error: "A valid report date is required (YYYY-MM-DD).",
      };
    }

    const [year, month, day] = dateValue.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, day));

    if (
      start.getUTCFullYear() !== year ||
      start.getUTCMonth() !== month - 1 ||
      start.getUTCDate() !== day
    ) {
      return { error: "Invalid report date." };
    }

    return {
      period,
      start,
      end: new Date(Date.UTC(year, month - 1, day + 1)),
      params: { date: dateValue },
    };
  }

  const year = Number(query.year ?? now.getUTCFullYear());

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: "Invalid report year." };
  }

  if (period === "annual") {
    return {
      period,
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year + 1, 0, 1)),
      params: { year },
    };
  }

  const month = Number(query.month ?? now.getUTCMonth() + 1);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { error: "Invalid report month." };
  }

  return {
    period,
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
    params: { year, month },
  };
}

// GET /documents/reports
export async function documentReports(req, res, next) {
  try {
    const direction = String(req.query.direction || "").toUpperCase();

    if (!DIRECTIONS.includes(direction)) {
      return res.status(400).json({
        message: "Report direction must be IN or OUT.",
      });
    }

    const range = buildReportRange(req.query);

    if (range.error) {
      return res.status(400).json({
        message: range.error,
      });
    }

    // Optional filter: the sender (incoming) or recipient (outgoing).
    const correspondentId = String(req.query.correspondentId || "");
    let correspondent = null;

    if (correspondentId) {
      correspondent = UUID_RE.test(correspondentId)
        ? await db.orm.public.Correspondent.select("id", "name")
            .where({ id: correspondentId })
            .first()
        : null;

      if (!correspondent) {
        return res.status(400).json({
          message: "Selected sender/recipient does not exist.",
        });
      }
    }

    let query = Document.where({ direction });
    if (correspondent) {
      query =
        direction === "IN"
          ? query.where({ senderId: correspondent.id })
          : query.where({ recipientId: correspondent.id });
    }

    const documents = await query
      .where((d) => d.documentDate.gte(range.start))
      .where((d) => d.documentDate.lt(range.end))
      .select(
        "id",
        "referenceNumber",
        "subject",
        "documentDate",
        "sender",
        "recipient",
        "department",
        "status",
        "isArchived",
      )
      .orderBy([(d) => d.documentDate.asc(), (d) => d.createdAt.asc()])
      .all();

    const count = (status) =>
      documents.filter((doc) => doc.status === status).length;

    const summary = {
      total: documents.length,
      pending: count("Pending"),
      processing: count("Processing"),
      completed: count("Completed"),
      archived: documents.filter((doc) => doc.isArchived).length,
    };

    res.json({
      direction,
      period: range.period,
      ...range.params,
      correspondent,
      summary,
      documents,
    });
  } catch (err) {
    next(err);
  }
}
