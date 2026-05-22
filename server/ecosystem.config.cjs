/**
 * PM2 config — reads server/.env once at start. Always use this instead of `pm2 start dist/index.js`.
 *
 *   cd ~/school-os/server && ./scripts/pm2-start.sh
 */
const path = require("path");
const fs = require("fs");

const appDir = __dirname;
const envPath = path.join(appDir, ".env");
const fileEnv = {};

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    fileEnv[key] = val;
  }
}

const dbUrl = fileEnv.DATABASE_URL || "";
if (!dbUrl || dbUrl.includes("://postgres:") || dbUrl.includes("://postgres@")) {
  console.error("\n[school-os] Fix .env — DATABASE_URL must use user schoolos, e.g.:");
  console.error("  DATABASE_URL=postgres://schoolos:YOUR_PASSWORD@127.0.0.1:5432/school_os\n");
  process.exit(1);
}
if (!dbUrl.includes("schoolos")) {
  console.error("\n[school-os] DATABASE_URL must contain user schoolos. Current:", dbUrl, "\n");
  process.exit(1);
}

const env = {
  NODE_ENV: fileEnv.NODE_ENV || "production",
  PORT: fileEnv.PORT || "5000",
  ...fileEnv,
};

module.exports = {
  apps: [
    {
      name: "school-os",
      script: "dist/index.js",
      cwd: appDir,
      env,
    },
  ],
};
