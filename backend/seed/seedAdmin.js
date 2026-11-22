import bcrypt from "bcryptjs";
import connectDB, { db } from "../config/db.js";

const User = db.orm.public.User;
const Department = db.orm.public.Department;

const ADMIN_NAME = "System Administrator";
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin";

async function seedAdmin() {
  try {
    // 1. Connect to PostgreSQL
    await connectDB();

    // 2. Check whether admin exists
    const existingAdmin = await User.where({ email: ADMIN_EMAIL }).first();

    if (existingAdmin) {
      console.log("Admin already exists:", ADMIN_EMAIL);
      return;
    }

    // 3. Find or create Administration department
    let department = await Department.where({ name: "Administration" }).first();

    if (!department) {
      department = await Department.create({
        name: "Administration",
      });

      console.log("Administration department created.");
    }

    // 4. Hash password
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

    // 5. Create admin account
    const admin = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: passwordHash,
      role: "admin",
      department: department.id,
    });

    console.log("--------------------------------");
    console.log("Admin created successfully!");
    console.log("Name:", admin.name);
    console.log("Email:", admin.email);
    console.log("Role:", admin.role);
    console.log("Department:", department.name);
    console.log("--------------------------------");
  } catch (error) {
    console.error("Admin seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

seedAdmin();
