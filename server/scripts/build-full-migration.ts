/**
 * Concatenates incremental migrations into one file for greenfield PostgreSQL installs.
 * Usage: npx ts-node scripts/build-full-migration.ts
 */
import fs from "fs";
import path from "path";

const migrationsDir = path.join(__dirname, "../src/db/migrations");
const order = [
  "0000_motionless_glorian.sql",
  "0001_student_documents.sql",
  "0002_phases_6_10.sql",
  "0003_phases_11_15.sql",
];

const header = `-- School OS — full schema (generated ${new Date().toISOString()})
-- Apply on empty database: psql $DATABASE_URL -f full_schema.sql
-- Or use: npm run db:migrate (incremental, recommended for upgrades)

`;

let body = "";
for (const file of order) {
  const fp = path.join(migrationsDir, file);
  if (!fs.existsSync(fp)) {
    console.error("Missing migration:", file);
    process.exit(1);
  }
  body += `\n-- ─── ${file} ───\n\n`;
  body += fs.readFileSync(fp, "utf8");
  body += "\n";
}

const out = path.join(migrationsDir, "full_schema.sql");
fs.writeFileSync(out, header + body);
console.log("Wrote", out, `(${Buffer.byteLength(header + body)} bytes)`);
