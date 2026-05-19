import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

const url = process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/school_os";
const max = 60;

async function wait() {
  for (let i = 0; i < max; i++) {
    try {
      const c = new Client({ connectionString: url });
      await c.connect();
      await c.end();
      console.log("PostgreSQL is ready");
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error("PostgreSQL did not become ready in time");
}

wait().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
