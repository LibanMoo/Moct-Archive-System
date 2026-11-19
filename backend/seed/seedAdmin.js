import "dotenv/config";
import bcrypt from "bcryptjs";
import connectDB from "../config/db.js";
import User from "../models/User.js";

await connectDB();
const name = process.env.ADMIN_NAME || "System Administrator";
const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD || "";

if (!email || password.length < 10) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 10 characters) in backend/.env first.");
  process.exit(1);
}

const existing = await User.findOne({ email });
if (existing) {
  console.log(`Admin account already exists: ${email}`);
  process.exit(0);
}
await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: "admin" });
console.log(`Admin created: ${email}. Sign in and change the temporary password policy according to your organisation.`);
process.exit(0);
