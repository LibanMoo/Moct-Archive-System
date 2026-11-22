import { db } from "../config/db.js";

const Correspondent = db.orm.public.Correspondent;

const FIELDS = ["name", "phone", "email", "address"];

function clean(value, max = 200) {
  if (value === undefined) return undefined;
  const text = String(value ?? "").trim().slice(0, max);
  return text || null;
}

async function nameTaken(name, exceptId) {
  // Case-insensitive exact match; escape LIKE wildcards in the name.
  const pattern = name.replace(/[\\%_]/g, "\\$&");
  const rows = await Correspondent.where((c) => c.name.ilike(pattern))
    .select("id")
    .limit(2)
    .all();
  return rows.some((r) => r.id !== exceptId);
}

// GET /correspondents?active=true
export async function listCorrespondents(req, res, next) {
  try {
    let query = Correspondent;
    if (req.query.active === "true") query = query.where({ active: true });

    const correspondents = await query
      .include("sentDocuments", (d) => d.count())
      .include("receivedDocuments", (d) => d.count())
      .orderBy((c) => c.name.asc())
      .all();

    res.json({
      correspondents: correspondents.map(
        ({ sentDocuments, receivedDocuments, ...c }) => ({
          ...c,
          sentCount: sentDocuments,
          receivedCount: receivedDocuments,
        }),
      ),
    });
  } catch (err) {
    next(err);
  }
}

// POST /correspondents
export async function createCorrespondent(req, res, next) {
  try {
    const name = clean(req.body.name, 200);
    if (!name) {
      return res.status(400).json({ message: "Name is required." });
    }
    if (await nameTaken(name)) {
      return res
        .status(409)
        .json({ message: "A sender/recipient with this name already exists." });
    }

    const correspondent = await Correspondent.create({
      name,
      phone: clean(req.body.phone, 50),
      email: clean(req.body.email, 200),
      address: clean(req.body.address, 300),
      active: true,
      createdById: req.user.id,
    });

    res.status(201).json({ correspondent });
  } catch (err) {
    next(err);
  }
}

// PATCH /correspondents/:id
export async function updateCorrespondent(req, res, next) {
  try {
    const existing = await Correspondent.where({ id: req.params.id }).first();
    if (!existing) {
      return res.status(404).json({ message: "Sender/recipient not found." });
    }

    const data = {};
    for (const key of FIELDS) {
      const value = clean(req.body[key], key === "address" ? 300 : 200);
      if (value !== undefined) data[key] = value;
    }
    if (typeof req.body.active === "boolean") data.active = req.body.active;

    if ("name" in data) {
      if (!data.name) {
        return res.status(400).json({ message: "Name cannot be empty." });
      }
      if (await nameTaken(data.name, existing.id)) {
        return res
          .status(409)
          .json({ message: "A sender/recipient with this name already exists." });
      }
    }

    const correspondent = await db.transaction(async (tx) => {
      const updated = await tx.orm.public.Correspondent.where({
        id: existing.id,
      }).update(data);

      // Keep document name snapshots in sync after a rename.
      if (data.name && data.name !== existing.name) {
        await tx.orm.public.Document.where({ senderId: existing.id }).updateAll({
          sender: data.name,
        });
        await tx.orm.public.Document.where({
          recipientId: existing.id,
        }).updateAll({ recipient: data.name });
      }

      return updated;
    });

    res.json({ correspondent });
  } catch (err) {
    next(err);
  }
}

// DELETE /correspondents/:id
export async function deleteCorrespondent(req, res, next) {
  try {
    const existing = await Correspondent.where({ id: req.params.id })
      .include("sentDocuments", (d) => d.count())
      .include("receivedDocuments", (d) => d.count())
      .first();

    if (!existing) {
      return res.status(404).json({ message: "Sender/recipient not found." });
    }

    if (existing.sentDocuments + existing.receivedDocuments > 0) {
      return res.status(400).json({
        message:
          "This sender/recipient is used by documents. Deactivate it instead so it no longer appears in the list.",
      });
    }

    await Correspondent.where({ id: existing.id }).delete();
    res.json({ message: "Sender/recipient deleted." });
  } catch (err) {
    next(err);
  }
}
