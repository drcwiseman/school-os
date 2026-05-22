/** Copy SQL migrations into dist so ensureRuntimeSchema can run them in production. */
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "../src/db/migrations");
const dest = path.join(__dirname, "../dist/db/migrations");

if (!fs.existsSync(src)) {
  console.warn("[copy-migrations] source missing:", src);
  process.exit(0);
}

fs.mkdirSync(dest, { recursive: true });
for (const name of fs.readdirSync(src)) {
  if (!name.endsWith(".sql")) continue;
  fs.copyFileSync(path.join(src, name), path.join(dest, name));
}
console.log("[copy-migrations] copied SQL files to dist/db/migrations");
