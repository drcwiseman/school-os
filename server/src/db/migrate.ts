import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";
import path from "path";

async function main() {
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: path.join(__dirname, "migrations") });
  console.log("Migrations complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
