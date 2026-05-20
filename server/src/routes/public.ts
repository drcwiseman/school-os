import { Router } from "express";
import { getPlatformMarketing, resolveMarketingAssetUrls } from "../services/platform-settings";
import { servePlatformMediaFile } from "../services/platform-media";
import { INTEGRATIONS_CATALOG } from "../lib/integrations-catalog";

const router = Router();

router.get("/site-config", async (_req, res, next) => {
  try {
    const marketing = resolveMarketingAssetUrls(await getPlatformMarketing());
    res.json({
      success: true,
      data: {
        marketing,
        integrations: INTEGRATIONS_CATALOG.filter((i) => i.popular).slice(0, 8),
      },
    });
  } catch (e) { next(e); }
});

router.get("/media/:id/file", async (req, res, next) => {
  try {
    const file = await servePlatformMediaFile(req.params.id);
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.sendFile(file.absPath);
  } catch (e) { next(e); }
});

router.get("/integrations", (_req, res) => {
  res.json({ success: true, data: INTEGRATIONS_CATALOG });
});

type LeadPayload = {
  fullName: string;
  role: string;
  email: string;
  phone?: string;
  schoolName: string;
  studentCount: string;
  painPoint: string;
  message?: string;
};

function validateLead(body: unknown): body is LeadPayload {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.fullName === "string" && b.fullName.length >= 2 &&
    typeof b.role === "string" &&
    typeof b.email === "string" && b.email.includes("@") &&
    typeof b.schoolName === "string" && b.schoolName.length >= 2 &&
    typeof b.studentCount === "string" &&
    typeof b.painPoint === "string"
  );
}

/** Public marketing lead capture — logs for now; wire to CRM/email in production */
router.post("/leads", (req, res) => {
  if (!validateLead(req.body)) {
    return res.status(400).json({ success: false, message: "Invalid lead payload" });
  }
  console.log("[LEAD]", JSON.stringify({ ...req.body, receivedAt: new Date().toISOString() }));
  res.status(201).json({ success: true, message: "Thank you — we will be in touch." });
});

export default router;
