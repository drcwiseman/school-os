import "./load-env";
import express, { type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import { errorHandler } from "./middleware/error";
import routes from "./routes/index";
import { rateLimit } from "./middleware/rate-limit";
import { tick as processJobs } from "./services/queue";
import { tickBackupScheduler } from "./services/backup-scheduler";
import { ensureRuntimeSchema } from "./db/ensure-runtime-schema";
import { warmRolePermissionsCache } from "./services/platform-role-settings";
import { attachTenantFromHost, isVerifiedCustomDomainHost, redirectSchoolHostToSlugPath } from "./middleware/host-tenant";

function isApiPath(url: string) {
  return url.startsWith("/api") || /^\/s\/[^/]+\/api(\/|$)/.test(url);
}

const clientDist = path.join(__dirname, "../../client/dist");
const indexHtml = path.join(clientDist, "index.html");

function readClientBuildId(): string | null {
  try {
    if (!fs.existsSync(indexHtml)) return null;
    const html = fs.readFileSync(indexHtml, "utf8");
    const m = html.match(/assets\/(index-[A-Za-z0-9_-]+\.js)/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

function sendSpaIndexHtml(res: Response) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.sendFile(indexHtml);
}

const app = express();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === "production";
const clientOrigin = process.env.CLIENT_ORIGIN;

// Enable CORS with support for credentials (cookies)
app.use(cors({
  origin: clientOrigin ? [clientOrigin] : true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(attachTenantFromHost);

// Basic Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms`);
  });
  next();
});

// Health check (includes DB — use to verify PM2 loaded DATABASE_URL)
app.get("/api/health", async (_req, res) => {
  const env = process.env.NODE_ENV || "development";
  let database: { ok: boolean; user?: string; host?: string; error?: string } = { ok: false };
  const raw = process.env.DATABASE_URL ?? "";
  try {
    const parsed = raw ? new URL(raw) : null;
    database.user = parsed?.username;
    database.host = parsed?.hostname;
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`select 1`);
    database.ok = true;
  } catch (err) {
    database.error = (err as Error).message?.slice(0, 200);
  }
  const status = database.ok ? 200 : 503;
  const clientBuild = readClientBuildId();
  res.status(status).json({
    success: database.ok,
    message: database.ok ? "Server is healthy" : "Database connection failed",
    timestamp: new Date().toISOString(),
    env,
    database,
    clientBuild,
    deployHint: clientBuild
      ? `Hard-refresh the portal (Ctrl+Shift+R). UI bundle should be ${clientBuild}.`
      : "client/dist missing on server — rebuild client",
  });
});

// Rate limiting on API routes
app.use("/api", rateLimit);
app.use("/s", rateLimit);

// All API routes
app.use(routes);

app.use(redirectSchoolHostToSlugPath);

// Serve built React SPA when dist exists (production or single-port deploy)
if (fs.existsSync(indexHtml)) {
  app.use(express.static(clientDist, {
    etag: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));
  app.get("*", (req, res, next) => {
    if (isApiPath(req.path)) return next();
    if (isVerifiedCustomDomainHost(req)) {
      const tenant = (req as any).resolvedTenantFromHost;
      const html = fs.readFileSync(indexHtml, "utf8");
      const payload = JSON.stringify({
        slug: tenant.slug,
        customDomain: tenant.customDomain,
        schoolName: tenant.name,
      });
      const script = `<script>window.__SCHOOLOS_TENANT__=${payload}</script>`;
      const out = html.includes("</head>") ? html.replace("</head>", `${script}</head>`) : script + html;
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      return res.type("html").send(out);
    }
    sendSpaIndexHtml(res);
  });
} else if (isProd) {
  console.warn("⚠️  client/dist not found — run: npm run build --prefix client");
}

// Centralized error handler (must be last)
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  setInterval(() => { processJobs().catch(() => {}); }, 5000);
  setInterval(() => { tickBackupScheduler().catch(() => {}); }, 60_000);

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });

  void ensureRuntimeSchema()
    .then(() => warmRolePermissionsCache())
    .catch((err) => {
      console.error("[startup] schema/permissions warmup failed:", (err as Error).message ?? err);
    });
}

export default app;
