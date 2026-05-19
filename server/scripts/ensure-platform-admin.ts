/**
 * Idempotent: create platform@schoolos.local if missing (demo / recovery).
 * Run: npm run db:ensure-platform --prefix server
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { platformAdmins } from "../src/db/schema";
import { hashPassword } from "../src/middleware/auth";

const EMAIL = "platform@schoolos.local";
const PASSWORD = "Platform123!";

async function main() {
  const [existing] = await db.select().from(platformAdmins).where(eq(platformAdmins.email, EMAIL)).limit(1);
  if (existing) {
    console.log(`Platform admin already exists: ${EMAIL}`);
    process.exit(0);
  }
  const passwordHash = await hashPassword(PASSWORD);
  await db.insert(platformAdmins).values({
    email: EMAIL,
    passwordHash,
    name: "Platform Operator",
    role: "super_admin",
  });
  console.log(`Created platform admin: ${EMAIL} / ${PASSWORD}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err.message || err);
  process.exit(1);
});
