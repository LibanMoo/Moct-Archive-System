import bcrypt from "bcryptjs";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";

export async function listUsers(_req, res, next) {
  try {
    const users = await User.find().select("-passwordHash").sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) { next(err); }
}

export async function createUser(req, res, next) {
  try {
    const { name, email, password, role = "staff", department = "" } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: "Name, email and password are required." });
    }
    if (password.length < 10) return res.status(400).json({ message: "Password must be at least 10 characters." });
    if (!["admin", "staff"].includes(role)) return res.status(400).json({ message: "Invalid role." });
    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ message: "A user with this email already exists." });
    const user = await User.create({
      name: name.trim(), email: email.toLowerCase().trim(),
      passwordHash: await bcrypt.hash(password, 12), role, department
    });
    res.status(201).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department } });
  } catch (err) { next(err); }
}

export async function setUserActive(req, res, next) {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot deactivate your own account." });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    user.active = Boolean(req.body.active);
    await user.save();
    res.json({ message: "User updated.", active: user.active });
  } catch (err) { next(err); }
}


export async function deleteUser(req, res, next) {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot delete your own account while signed in." });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin", active: true });
      if (adminCount <= 1) {
        return res.status(400).json({ message: "The last active administrator cannot be deleted." });
      }
    }

    await AuditLog.create({
      actor: req.user._id,
      action: "USER_DELETED",
      details: `Deleted user ${user.name} (${user.email})`
    });
    await User.findByIdAndDelete(user._id);
    res.json({ message: "User permanently deleted." });
  } catch (err) { next(err); }
}
