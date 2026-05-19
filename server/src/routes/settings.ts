import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { tenantSettings } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { validate } from "../utils/validate";
import { createAuditLog } from "../services/audit";
import { NotFoundError } from "../middleware/error";
import { getTenantFeatureFlags, setTenantFeaturesBulk } from "../services/tenant-features";
import { CURRENCY_CODES, defaultCurrencyForCountry } from "../lib/currencies";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

router.get("/", ...guard, requirePermission("settings.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
    if (!settings) throw new NotFoundError("Settings not found");
    const flags = await getTenantFeatureFlags(tenant.id);
    res.json({
      success: true,
      data: {
        ...settings,
        featureFlagsJson: { ...(settings.featureFlagsJson as object ?? {}), ...flags },
      },
    });
  } catch (e) { next(e); }
});

router.patch("/", ...guard, requirePermission("settings.manage"),
  validate({
    body: z.object({
      country: z.string().length(2).optional(),
      currency: z.string().min(3).max(3).optional(),
      timezone: z.string().min(1).optional(),
      brandingJson: z.record(z.string()).optional(),
      featureFlagsJson: z.record(z.boolean()).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [before] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
      if (!before) throw new NotFoundError("Settings not found");
      const patch: Record<string, unknown> = { ...req.body };
      if (patch.country !== undefined) patch.country = String(patch.country).toUpperCase();
      if (patch.currency !== undefined) {
        const c = String(patch.currency).toUpperCase();
        if (!CURRENCY_CODES.has(c)) return res.status(400).json({ success: false, message: "Unsupported currency" });
        patch.currency = c;
      }
      if (patch.country && !patch.currency && !req.body.currency) {
        patch.currency = defaultCurrencyForCountry(String(patch.country));
      }
      if (patch.featureFlagsJson) {
        const updates = Object.entries(patch.featureFlagsJson).map(([code, enabled]) => ({
          code,
          enabled: Boolean(enabled),
        }));
        const merged = await setTenantFeaturesBulk(tenant.id, updates);
        patch.featureFlagsJson = merged;
      }
      const [updated] = await db.update(tenantSettings)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(tenantSettings.tenantId, tenant.id))
        .returning();
      await createAuditLog({
        tenantId: tenant.id, actorUserId: user.id, action: "settings.update",
        entityType: "tenant_settings", entityId: updated.id, before, after: updated, ip: req.ip,
      });
      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  },
);

export default router;
