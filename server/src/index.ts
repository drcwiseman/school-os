import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import { errorHandler } from "./middleware/error";
import routes from "./routes/index";
import { rateLimit } from "./middleware/rate-limit";
import { tick as processJobs } from "./services/queue";

// Load environment variables
dotenv.config();

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

// Basic Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${Date.now() - start}ms`);
  });
  next();
});

// Health check
app.get("/api/health", (_req, res) => {
  res.status(200).json({ success: true, message: "Server is healthy", timestamp: new Date().toISOString(), env: process.env.NODE_ENV || "development" });
});

// Rate limiting on API routes
app.use("/api", rateLimit);
app.use("/s", rateLimit);

// All API routes
app.use(routes);

// Production: serve built React app (API routes registered above take precedence)
if (isProd) {
  const clientDist = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Centralized error handler (must be last)
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  setInterval(() => { processJobs().catch(() => {}); }, 5000);
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

export default app;
