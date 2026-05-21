import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { tenantSettings } from "../db/schema";
import { tenantSettingsCoreColumns } from "../lib/tenant-settings-columns";
import { safeDb } from "../lib/safe-db";
import type { TenantSmtpSettings, TenantCommunicationsSettings } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireTenantMatch } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";
import { requireTenantFeature } from "../middleware/require-feature";
import { validate } from "../utils/validate";
import { createAuditLog } from "../services/audit";
import { NotFoundError, ForbiddenError } from "../middleware/error";
import { getTenantFeatureFlags, setTenantFeaturesBulk, isTenantFeatureEnabled } from "../services/tenant-features";
import { CURRENCY_CODES, defaultCurrencyForCountry } from "../lib/currencies";
import { resolveTenantLocale } from "../services/tenant-locale";
import {
  maskSmtpForApi,
  sendTenantEmail,
  verifyTenantSmtp,
  assertCustomSmtpAllowed,
} from "../services/tenant-email";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

const smtpBodySchema = z.object({
  enabled: z.boolean().optional(),
  host: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  user: z.string().optional(),
  fromEmail: z.string().email().optional(),
  fromName: z.string().optional(),
  password: z.string().optional(),
});

function mergeSmtp(
  existing: TenantSmtpSettings,
  patch: z.infer<typeof smtpBodySchema>,
): TenantSmtpSettings {
  const next: TenantSmtpSettings = { ...existing, ...patch };
  if (patch.password === "") delete next.password;
  if (patch.password && patch.password.length > 0) next.password = patch.password;
  else if (!patch.password) next.password = existing.password;
  return next;
}

router.get("/", ...guard, requirePermission("settings.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    let settings = await safeDb("settings-full", null as typeof tenantSettings.$inferSelect | null, async () => {
      const [row] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
      return row ?? null;
    });
    if (!settings) {
      const [row] = await db.select(tenantSettingsCoreColumns).from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
      settings = row ? {
        ...row,
        smtpSettingsJson: {},
        communicationsJson: {},
        paymentProvidersJson: {},
        securityJson: {},
        brandingExtendedJson: {},
        themeJson: {},
        sidebarOrderJson: [],
        admissionWorkflowJson: [],
        onboardingChecklistJson: [],
        setupWizardJson: {},
        curriculumFramework: null,
        latePenaltyPercent: 0,
      } as typeof tenantSettings.$inferSelect : null;
    }
    if (!settings) throw new NotFoundError("Settings not found");
    const locale = resolveTenantLocale(settings);
    const flags = await getTenantFeatureFlags(tenant.id);
    const smtpAllowed = await isTenantFeatureEnabled(tenant.id, "custom_smtp");
    res.json({
      success: true,
      data: {
        ...settings,
        country: locale.country,
        currency: locale.currency,
        featureFlagsJson: { ...(settings.featureFlagsJson as object ?? {}), ...flags },
        smtpSettingsJson: smtpAllowed
          ? maskSmtpForApi(settings.smtpSettingsJson as TenantSmtpSettings)
          : null,
        customSmtpAllowed: smtpAllowed,
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
      brandingExtendedJson: z.record(z.unknown()).optional(),
      paymentProvidersJson: z.record(z.unknown()).optional(),
      themeJson: z.object({ mode: z.enum(["light", "dark"]).optional(), accent: z.string().optional() }).optional(),
      sidebarOrderJson: z.array(z.string()).optional(),
      admissionWorkflowJson: z.array(z.string()).optional(),
      onboardingChecklistJson: z.array(z.object({ label: z.string(), done: z.boolean().optional() })).optional(),
      curriculumFramework: z.string().optional(),
      latePenaltyPercent: z.number().int().min(0).max(100).optional(),
      communicationsJson: z.object({
        smsProvider: z.string().optional(),
        smsSenderId: z.string().optional(),
        whatsappEnabled: z.boolean().optional(),
        pushEnabled: z.boolean().optional(),
        emailBrandingName: z.string().optional(),
      }).optional(),
      featureFlagsJson: z.record(z.boolean()).optional(),
      smtpSettingsJson: smtpBodySchema.optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [before] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
      if (!before) throw new NotFoundError("Settings not found");
      const patch: Record<string, unknown> = { ...req.body };
      if (patch.country !== undefined) {
        const cc = String(patch.country).toUpperCase().trim();
        patch.country = cc || resolveTenantLocale(before).country;
      }
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
      if (patch.smtpSettingsJson) {
        try {
          await assertCustomSmtpAllowed(tenant.id);
        } catch {
          return next(new ForbiddenError("Custom SMTP is not included in your subscription plan"));
        }
        const existing = (before.smtpSettingsJson ?? {}) as TenantSmtpSettings;
        patch.smtpSettingsJson = mergeSmtp(existing, patch.smtpSettingsJson as z.infer<typeof smtpBodySchema>);
      }
      const [updated] = await db.update(tenantSettings)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(tenantSettings.tenantId, tenant.id))
        .returning();
      await createAuditLog({
        tenantId: tenant.id, actorUserId: user.id, action: "settings.update",
        entityType: "tenant_settings", entityId: updated.id, before, after: updated, ip: req.ip,
      });
      const smtpAllowed = await isTenantFeatureEnabled(tenant.id, "custom_smtp");
      res.json({
        success: true,
        data: {
          ...updated,
          smtpSettingsJson: smtpAllowed
            ? maskSmtpForApi(updated.smtpSettingsJson as TenantSmtpSettings)
            : null,
        },
      });
    } catch (e) { next(e); }
  },
);

router.post(
  "/smtp/test",
  ...guard,
  requirePermission("settings.manage"),
  requireTenantFeature("custom_smtp"),
  validate({
    body: z.object({
      testEmail: z.string().email().optional(),
      smtpSettingsJson: smtpBodySchema.optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
      if (!settings) throw new NotFoundError("Settings not found");
      const existing = (settings.smtpSettingsJson ?? {}) as TenantSmtpSettings;
      const smtp = req.body.smtpSettingsJson
        ? mergeSmtp(existing, req.body.smtpSettingsJson)
        : existing;

      await verifyTenantSmtp(smtp);
      const to = req.body.testEmail || user.email;
      await sendTenantEmail(tenant.id, smtp, {
        to,
        subject: "SchoolOS SMTP test",
        text: "If you received this message, your school's SMTP settings are working correctly.",
        html: "<p>If you received this message, your school's <strong>SMTP settings</strong> are working correctly.</p>",
      });
      res.json({ success: true, message: `Test email sent to ${to}` });
    } catch (e) { next(e); }
  },
);

router.get("/export", ...guard, requirePermission("settings.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
    const flags = await getTenantFeatureFlags(tenant.id);
    res.json({
      success: true,
      data: {
        exportedAt: new Date().toISOString(),
        settings: settings ? { ...settings, smtpSettingsJson: undefined } : null,
        featureFlags: flags,
      },
    });
  } catch (e) { next(e); }
});

router.post("/import", ...guard, requirePermission("settings.manage"),
  validate({
    body: z.object({
      brandingJson: z.record(z.string()).optional(),
      brandingExtendedJson: z.record(z.unknown()).optional(),
      communicationsJson: z.record(z.unknown()).optional(),
      paymentProvidersJson: z.record(z.unknown()).optional(),
      country: z.string().length(2).optional(),
      currency: z.string().optional(),
      timezone: z.string().optional(),
      curriculumFramework: z.string().optional(),
      latePenaltyPercent: z.number().int().min(0).max(100).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [before] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
      if (!before) throw new NotFoundError("Settings not found");
      const [updated] = await db.update(tenantSettings)
        .set({ ...req.body, updatedAt: new Date() })
        .where(eq(tenantSettings.tenantId, tenant.id))
        .returning();
      await createAuditLog({
        tenantId: tenant.id, actorUserId: user.id, action: "settings.import",
        entityType: "tenant_settings", entityId: updated.id, before, after: updated, ip: req.ip,
      });
      res.json({ success: true, data: updated });
    } catch (e) { next(e); }
  },
);

export default router;
