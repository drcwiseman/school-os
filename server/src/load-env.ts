/**
 * Must load before any module that reads process.env (especially db pool).
 * Compiled to dist/load-env.js — path resolves to server/.env.
 */
import dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(__dirname, "../.env");
// override: true — PM2 often injects a stale postgres://postgres URL from an old dump
const result = dotenv.config({ path: envPath, override: true });
if (result.error && process.env.NODE_ENV === "production") {
  console.warn("[load-env] Could not read .env at", envPath, result.error.message);
}
const dbUrl = process.env.DATABASE_URL ?? "";
if (!dbUrl || /^postgres:\/\/postgres[:@]/i.test(dbUrl)) {
  console.error(
    "[load-env] DATABASE_URL must use the schoolos user and 127.0.0.1, e.g.",
    "postgres://schoolos:PASSWORD@127.0.0.1:5432/school_os",
  );
}
