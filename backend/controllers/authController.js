import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

function safeUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department };
}

export async function login(req, res, next) {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }

    const token = jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "8h"
    });
    res.json({ token, user: safeUser(user) });
  } catch (err) { next(err); }
}

export async function me(req, res) {
  res.json({ user: safeUser(req.user) });
}
