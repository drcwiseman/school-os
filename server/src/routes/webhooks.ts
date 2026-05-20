import { Router } from "express";
import { db } from "../db";
import { platformAuditLogs } from "../db/schema";
import { loadRawIntegrationCredentials } from "../services/platform-integrations-settings";
import {
  handleFlutterwaveWebhook,
  handleMtnMomoWebhook,
  handlePesapalWebhook,
} from "../services/webhook-billing";

const router = Router();

function logWebhook(provider: string, body: unknown, headers: Record<string, unknown>) {
  return db.insert(platformAuditLogs).values({
    action: `webhook.${provider}`,
    entityType: "webhook",
    entityId: provider,
    afterJson: { body, headers: Object.fromEntries(Object.entries(headers).slice(0, 12)) },
  });
}

router.post("/flutterwave", async (req, res, next) => {
  try {
    const creds = await loadRawIntegrationCredentials("flutterwave");
    const secret = creds.secretKey;
    const signature = req.headers["verif-hash"] as string | undefined;
    if (secret && signature && signature !== secret) {
      return res.status(401).json({ success: false, message: "Invalid signature" });
    }
    await logWebhook("flutterwave", req.body, req.headers as Record<string, unknown>);
    const result = await handleFlutterwaveWebhook(req.body as Record<string, unknown>);
    res.json({ success: result.ok, data: result });
  } catch (err) { next(err); }
});

router.post("/mtn-momo", async (req, res, next) => {
  try {
    await logWebhook("mtn_momo", req.body, req.headers as Record<string, unknown>);
    const result = await handleMtnMomoWebhook(req.body as Record<string, unknown>);
    res.json({ success: result.ok, data: result });
  } catch (err) { next(err); }
});

router.post("/airtel-money", async (req, res, next) => {
  try {
    await logWebhook("airtel_money", req.body, req.headers as Record<string, unknown>);
    res.json({ success: true, message: "Logged — use Pesapal/Flutterwave reference format for auto-reconcile" });
  } catch (err) { next(err); }
});

router.post("/pesapal", async (req, res, next) => {
  try {
    await logWebhook("pesapal", req.body, req.headers as Record<string, unknown>);
    const result = await handlePesapalWebhook(req.body as Record<string, unknown>);
    res.json({ success: result.ok, data: result });
  } catch (err) { next(err); }
});

router.post("/whatsapp", async (req, res, next) => {
  try {
    await logWebhook("whatsapp_business", req.body, req.headers as Record<string, unknown>);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get("/health", (_req, res) => {
  res.json({ success: true, message: "SchoolOS webhooks endpoint" });
});

export default router;
