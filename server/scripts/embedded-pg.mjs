import EmbeddedPostgres from "embedded-postgres";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../.data/postgres");
const PORT = Number(process.env.PG_PORT || 5432);
const USER = "postgres";
const PASSWORD = "postgres";
const DB = "school_os";

fs.mkdirSync(DATA_DIR, { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
});

console.log("Starting embedded PostgreSQL (first run may download binaries)...");
if (!fs.existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
  await pg.initialise();
}
await pg.start();

try {
  await pg.createDatabase(DB);
  console.log(`Created database: ${DB}`);
} catch {
  console.log(`Database ${DB} already exists`);
}

const url = `postgres://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}`;
console.log("\n✅ PostgreSQL ready");
console.log(`   DATABASE_URL=${url}\n`);

const envPath = path.join(__dirname, "../.env");
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
if (/^DATABASE_URL=/m.test(env)) {
  env = env.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url}`);
} else {
  env += `\nDATABASE_URL=${url}\n`;
}
fs.writeFileSync(envPath, env);

console.log("Press Ctrl+C to stop PostgreSQL.");
process.on("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});
await new Promise(() => {});
