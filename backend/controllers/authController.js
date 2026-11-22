import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../config/db.js";

// Only expose safe user information
export function safeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.department ?? null,
    department: user.departmentInfo?.name ?? "",
    active: user.active,
    createdAt: user.createdAt,
  };
}

// Login
export async function login(req, res, next) {
  try {
    const email = String(req.body.email || "")
      .toLowerCase()
      .trim();

    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await db.orm.public.User.include("departmentInfo", (d) =>
      d.select("id", "name"),
    )
      .where({ email })
      .first();

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Email or password is incorrect.",
      });
    }

    if (!user.active) {
      return res.status(403).json({
        message: "This account has been deactivated.",
      });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      },
    );

    return res.json({
      token,
      user: safeUser(user),
    });
  } catch (err) {
    next(err);
  }
}

// Get authenticated user
export async function me(req, res) {
  if (!req.user) {
    return res.status(401).json({
      message: "Not authenticated.",
    });
  }

  return res.json({
    user: safeUser(req.user),
  });
}
