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
      const patch = { ...req.body };
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
