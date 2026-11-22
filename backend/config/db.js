import "dotenv/config";
import postgres from "@prisma/orm-postgres/runtime";
import { contractFromJson } from "@prisma/orm-postgres/static";
import contractJson from "../src/prisma/contract.json" with { type: "json" };

const contract = contractFromJson(contractJson);

const db = postgres({
  contract,
  url: process.env.DATABASE_URL,
});

export default async function connectDB() {
  await db.connect();
  console.log("PostgreSQL connected successfully");
}

export { db };
