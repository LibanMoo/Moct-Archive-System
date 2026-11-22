import bcrypt from "bcryptjs";
import { db } from "../config/db.js";
import { safeUser } from "./authController.js";

const User = db.orm.public.User;
const Department = db.orm.public.Department;

const withDepartment = (users) =>
  users.include("departmentInfo", (d) => d.select("id", "name"));

// Find a department by name, creating it if needed. Returns its id or null.
async function resolveDepartmentId(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return null;

  const existing = await Department.where({ name: trimmed }).first();
  if (existing) return existing.id;

  const created = await Department.create({ name: trimmed });
  return created.id;
}

// GET ALL USERS
export async function listUsers(_req, res, next) {
  try {
    const users = await withDepartment(User)
      .orderBy((u) => u.createdAt.desc())
      .all();

    return res.json({
      users: users.map(safeUser),
    });
  } catch (err) {
    next(err);
  }
}

// CREATE USER
export async function createUser(req, res, next) {
  try {
    const { name, email, password, role = "staff", department = "" } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    if (name.trim().length > 120) {
      return res.status(400).json({
        message: "Name cannot exceed 120 characters.",
      });
    }

    if (password.length < 10) {
      return res.status(400).json({
        message: "Password must be at least 10 characters.",
      });
    }

    if (!["admin", "staff"].includes(role)) {
      return res.status(400).json({
        message: "Invalid role.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const exists = await User.where({ email: normalizedEmail }).first();

    if (exists) {
      return res.status(409).json({
        message: "A user with this email already exists.",
      });
    }

    const created = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role,
      department: await resolveDepartmentId(department),
      active: true,
    });

    const user = await withDepartment(User).where({ id: created.id }).first();

    return res.status(201).json({
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

// ACTIVATE / DEACTIVATE USER
export async function setUserActive(req, res, next) {
  try {
    const userId = req.params.id;

    if (userId === req.user.id) {
      return res.status(400).json({
        message: "You cannot deactivate your own account.",
      });
    }

    const existingUser = await User.where({ id: userId }).first();

    if (!existingUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const active = req.body.active === true;

    const updatedUser = await User.where({ id: userId }).update({ active });

    return res.json({
      message: "User updated.",
      active: updatedUser.active,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE USER
export async function deleteUser(req, res, next) {
  try {
    const userId = req.params.id;

    if (userId === req.user.id) {
      return res.status(400).json({
        message: "You cannot delete your own account while signed in.",
      });
    }

    const user = await User.where({ id: userId }).first();

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    // Protect the last active administrator
    if (user.role === "admin" && user.active) {
      const { count } = await User.where({ role: "admin", active: true }).aggregate(
        (a) => ({ count: a.count() }),
      );

      if (count <= 1) {
        return res.status(400).json({
          message: "The last active administrator cannot be deleted.",
        });
      }
    }

    await db.transaction(async (tx) => {
      await tx.orm.public.AuditLog.create({
        userId: req.user.id,
        action: "USER_DELETED",
        details: `Deleted user ${user.name} (${user.email})`,
        ipAddress: req.ip,
      });

      await tx.orm.public.User.where({ id: userId }).delete();
    });

    return res.json({
      message: "User permanently deleted.",
    });
  } catch (err) {
    next(err);
  }
}
