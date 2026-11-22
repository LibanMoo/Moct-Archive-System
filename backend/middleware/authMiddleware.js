import jwt from "jsonwebtoken";
import { db } from "../config/db.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required. Use Authorization: Bearer <token>.",
    });
  }

  let payload;
  try {
    payload = jwt.verify(header.slice(7).trim(), process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({
      message: "Invalid or expired authentication token.",
    });
  }

  try {
    const user = await db.orm.public.User.select(
      "id",
      "name",
      "email",
      "role",
      "department",
      "active",
    )
      .include("departmentInfo", (d) => d.select("id", "name"))
      .where({ id: payload.sub })
      .first();

    if (!user || !user.active) {
      return res.status(401).json({
        message: "Account is unavailable.",
      });
    }

    req.user = user;
    return next();
  } catch (err) {
    // Database problems are server errors, not auth failures.
    return next(err);
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      message: "Administrator permission required.",
    });
  }

  return next();
}
