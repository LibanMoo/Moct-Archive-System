import { db } from "../config/db.js";

const Department = db.orm.public.Department;

function cleanName(value) {
  return String(value ?? "").trim().slice(0, 150);
}

async function nameTaken(name, exceptId) {
  // Case-insensitive exact match; escape LIKE wildcards in the name.
  const pattern = name.replace(/[\\%_]/g, "\\$&");
  const rows = await Department.where((d) => d.name.ilike(pattern))
    .select("id")
    .limit(2)
    .all();
  return rows.some((r) => r.id !== exceptId);
}

const withUsage = (q) =>
  q
    .include("users", (u) => u.count())
    .include("documents", (d) => d.count())
    .include("sentInternal", (d) => d.count())
    .include("receivedInternal", (d) => d.count());

function shape({ users, documents, sentInternal, receivedInternal, ...d }) {
  return {
    ...d,
    userCount: users,
    documentCount: documents,
    internalSentCount: sentInternal,
    internalReceivedCount: receivedInternal,
  };
}

// GET /departments
export async function listDepartments(_req, res, next) {
  try {
    const rows = await withUsage(Department)
      .orderBy((d) => d.name.asc())
      .all();
    res.json({ departments: rows.map(shape) });
  } catch (err) {
    next(err);
  }
}

// POST /departments
export async function createDepartment(req, res, next) {
  try {
    const name = cleanName(req.body.name);
    if (!name) return res.status(400).json({ message: "Department name is required." });
    if (await nameTaken(name)) {
      return res.status(409).json({ message: "A department with this name already exists." });
    }

    const department = await Department.create({ name, CreatedBy: req.user.id });
    res.status(201).json({ department });
  } catch (err) {
    next(err);
  }
}

// PATCH /departments/:id  (rename)
export async function updateDepartment(req, res, next) {
  try {
    const existing = await Department.where({ id: req.params.id }).first();
    if (!existing) return res.status(404).json({ message: "Department not found." });

    const name = cleanName(req.body.name);
    if (!name) return res.status(400).json({ message: "Department name is required." });
    if (await nameTaken(name, existing.id)) {
      return res.status(409).json({ message: "A department with this name already exists." });
    }

    const department = await db.transaction(async (tx) => {
      const updated = await tx.orm.public.Department.where({ id: existing.id }).update({
        name,
        UpdatedBy: req.user.id,
      });
      // Keep the name snapshot on documents in sync.
      await tx.orm.public.Document.where({ departmentId: existing.id }).updateAll({
        department: name,
      });
      return updated;
    });

    res.json({ department });
  } catch (err) {
    next(err);
  }
}

// DELETE /departments/:id
export async function deleteDepartment(req, res, next) {
  try {
    const existing = await withUsage(Department).where({ id: req.params.id }).first();
    if (!existing) return res.status(404).json({ message: "Department not found." });

    const d = shape(existing);
    if (d.userCount + d.documentCount + d.internalSentCount + d.internalReceivedCount > 0) {
      return res.status(400).json({
        message: "This department is used by users or documents and cannot be deleted.",
      });
    }

    await Department.where({ id: existing.id }).delete();
    res.json({ message: "Department deleted." });
  } catch (err) {
    next(err);
  }
}
