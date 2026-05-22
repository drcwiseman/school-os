import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { tenantSettings, tenants } from "../db/schema";
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
import { NotFoundError, ForbiddenError, ConflictError } from "../middleware/error";
import { getTenantFeatureFlags, setTenantFeaturesBulk, isTenantFeatureEnabled, getTenantFeaturesDetailed } from "../services/tenant-features";
import { CURRENCY_CODES, defaultCurrencyForCountry } from "../lib/currencies";
import { resolveTenantLocale } from "../services/tenant-locale";
import {
  maskSmtpForApi,
  sendTenantEmail,
  verifyTenantSmtp,
  assertCustomSmtpAllowed,
} from "../services/tenant-email";
import { writeTenantFile, resolveTenantFile } from "../lib/uploads";
import { maskPaymentProvidersForApi, normalizePaymentProviders } from "../lib/payment-providers";
import { getDomainInstructions, setCustomDomain } from "../services/domain-verify";
import { verifyDomainDns } from "../services/dns-verification";

const router = Router();
const guard = [requireAuth, requireTenantMatch];

function brandingLogoUrl(slug: string) {
  return `/s/${slug}/api/settings/branding/logo`;
}

const emptyToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);

const paymentProvidersBodySchema = z.object({
  paypal: z.object({
    enabled: z.coerce.boolean().optional(),
    clientId: z.preprocess(emptyToUndefined, z.string().optional()),
  }).optional(),
  pesapal: z.object({
    enabled: z.coerce.boolean().optional(),
    consumerKey: z.preprocess(emptyToUndefined, z.string().optional()),
    consumerSecret: z.string().optional(),
  }).optional(),
}).passthrough();

const smtpBodySchema = z.object({
  enabled: z.boolean().optional(),
  host: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  user: z.preprocess(emptyToUndefined, z.string().optional()),
  fromEmail: z.preprocess(
    emptyToUndefined,
    z.union([z.string().email(), z.literal("")]).optional(),
  ),
  fromName: z.preprocess(emptyToUndefined, z.string().optional()),
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

router.get("/features", ...guard, requirePermission("settings.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    res.json({ success: true, data: await getTenantFeaturesDetailed(tenant.id) });
  } catch (e) { next(e); }
});

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
    const domain = await getDomainInstructions(tenant);
    res.json({
      success: true,
      data: {
        ...settings,
        country: locale.country,
        currency: locale.currency,
        featureFlagsJson: { ...(settings.featureFlagsJson as object ?? {}), ...flags },
        paymentProvidersJson: maskPaymentProvidersForApi(
          settings.paymentProvidersJson as Record<string, unknown>,
        ),
        smtpSettingsJson: smtpAllowed
          ? maskSmtpForApi(settings.smtpSettingsJson as TenantSmtpSettings)
          : null,
        customSmtpAllowed: smtpAllowed,
        brandingLogoUrl: brandingLogoUrl(tenant.slug),
        domain,
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
      brandingJson: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
      brandingExtendedJson: z.record(z.string(), z.unknown()).optional(),
      paymentProvidersJson: paymentProvidersBodySchema.optional(),
      themeJson: z.object({ mode: z.enum(["light", "dark"]).optional(), accent: z.string().optional() }).optional(),
      sidebarOrderJson: z.array(z.string()).optional(),
      admissionWorkflowJson: z.array(z.string()).optional(),
      onboardingChecklistJson: z.array(z.object({ label: z.string(), done: z.boolean().optional() })).optional(),
      curriculumFramework: z.preprocess(emptyToUndefined, z.string().optional()),
      latePenaltyPercent: z.coerce.number().int().min(0).max(100).optional(),
      communicationsJson: z.object({
        smsProvider: z.string().optional(),
        smsSenderId: z.string().optional(),
        whatsappEnabled: z.boolean().optional(),
        pushEnabled: z.boolean().optional(),
        emailBrandingName: z.string().optional(),
      }).passthrough().optional(),
      featureFlagsJson: z.record(z.string(), z.coerce.boolean()).optional(),
      smtpSettingsJson: smtpBodySchema.optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const user = (req as any).user;
      const [before] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
      if (!before) throw new NotFoundError("Settings not found");
      const patch: Record<string, unknown> = { ...req.body, updatedAt: new Date() };
      if (patch.brandingJson) {
        patch.brandingJson = { ...(before.brandingJson as object ?? {}), ...(patch.brandingJson as object) };
      }
      if (patch.brandingExtendedJson) {
        patch.brandingExtendedJson = { ...(before.brandingExtendedJson as object ?? {}), ...(patch.brandingExtendedJson as object) };
      }
      if (patch.communicationsJson) {
        patch.communicationsJson = { ...(before.communicationsJson as object ?? {}), ...(patch.communicationsJson as object) };
      }
      if (patch.paymentProvidersJson) {
        const existing = normalizePaymentProviders(before.paymentProvidersJson as Record<string, unknown>);
        const incoming = normalizePaymentProviders(patch.paymentProvidersJson as Record<string, unknown>);
        const merged = {
          paypal: { ...existing.paypal, ...incoming.paypal },
          pesapal: { ...existing.pesapal, ...incoming.pesapal },
        };
        if (!incoming.pesapal?.consumerSecret?.trim() && existing.pesapal?.consumerSecret) {
          merged.pesapal = { ...merged.pesapal, consumerSecret: existing.pesapal.consumerSecret };
        }
        patch.paymentProvidersJson = merged;
      }
      if (patch.themeJson) {
        patch.themeJson = { ...(before.themeJson as object ?? {}), ...(patch.themeJson as object) };
      }
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
        const smtpPatch = patch.smtpSettingsJson as z.infer<typeof smtpBodySchema>;
        if (smtpPatch.enabled) {
          try {
            await assertCustomSmtpAllowed(tenant.id);
          } catch {
            return next(new ForbiddenError("Custom SMTP is not included in your subscription plan"));
          }
          const existing = (before.smtpSettingsJson ?? {}) as TenantSmtpSettings;
          patch.smtpSettingsJson = mergeSmtp(existing, smtpPatch);
        } else {
          const existing = (before.smtpSettingsJson ?? {}) as TenantSmtpSettings;
          patch.smtpSettingsJson = { ...existing, enabled: false };
        }
      }
      const [updated] = await db.update(tenantSettings)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(tenantSettings.tenantId, tenant.id))
        .returning();

      const ext = (updated.brandingExtendedJson ?? {}) as { customDomain?: string };
      if (typeof ext.customDomain === "string") {
        const raw = ext.customDomain.trim();
        if (raw) {
          try {
            await setCustomDomain(tenant.id, raw);
          } catch (err) {
            return res.status(400).json({
              success: false,
              message: err instanceof Error ? err.message : "Invalid custom domain",
            });
          }
        } else {
          await db
            .update(tenants)
            .set({
              customDomain: null,
              domainVerified: false,
              sslConfig: { status: "none" },
              updatedAt: new Date(),
            })
            .where(eq(tenants.id, tenant.id));
        }
      }

      await createAuditLog({
        tenantId: tenant.id, actorUserId: user.id, action: "settings.update",
        entityType: "tenant_settings", entityId: updated.id, before, after: updated, ip: req.ip,
      });
      const smtpAllowed = await isTenantFeatureEnabled(tenant.id, "custom_smtp");
      const [freshTenant] = await db.select().from(tenants).where(eq(tenants.id, tenant.id)).limit(1);
      const domain = freshTenant ? await getDomainInstructions(freshTenant) : null;
      res.json({
        success: true,
        data: {
          ...updated,
          smtpSettingsJson: smtpAllowed
            ? maskSmtpForApi(updated.smtpSettingsJson as TenantSmtpSettings)
            : null,
          domain,
        },
      });
    } catch (e) { next(e); }
  },
);

router.get("/domain", ...guard, requirePermission("settings.view"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.select().from(tenants).where(eq(tenants.id, tenant.id)).limit(1);
    if (!row) throw new NotFoundError("School not found");
    res.json({ success: true, data: await getDomainInstructions(row) });
  } catch (e) { next(e); }
});

router.post("/domain/verify", ...guard, requirePermission("settings.manage"), async (req, res, next) => {
  try {
    const tenant = (req as any).tenant;
    const [row] = await db.select().from(tenants).where(eq(tenants.id, tenant.id)).limit(1);
    if (!row?.customDomain) {
      return res.status(400).json({
        success: false,
        message: "Save a custom domain in Branding first, then verify DNS.",
      });
    }
    const dns = await verifyDomainDns(tenant.id, row.customDomain);
    const [fresh] = await db.select().from(tenants).where(eq(tenants.id, tenant.id)).limit(1);
    if (!dns.verified) {
      return res.status(400).json({
        success: false,
        message: dns.error ?? "DNS not pointing to SchoolOS yet. Add the CNAME or A record below, wait a few minutes, then try again.",
        data: { dns, domain: fresh ? await getDomainInstructions(fresh) : null },
      });
    }
    res.json({
      success: true,
      message: "Domain verified. Staff and portal can use clean URLs on your domain.",
      data: { dns, domain: fresh ? await getDomainInstructions(fresh) : null },
    });
  } catch (e) { next(e); }
});

router.post(
  "/branding/logo",
  ...guard,
  requirePermission("settings.manage"),
  validate({
    body: z.object({
      fileName: z.string().min(1),
      contentBase64: z.string().min(1),
      mimeType: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [before] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
      if (!before) throw new NotFoundError("Settings not found");
      const { validateUpload } = await import("../middleware/upload");
      const { safeName, size } = validateUpload(req.body.fileName, req.body.mimeType, req.body.contentBase64);
      const buffer = Buffer.from(req.body.contentBase64, "base64");
      if (buffer.length !== size) throw new ConflictError("Invalid file payload");
      const filePath = writeTenantFile(tenant.id, ["branding"], `${Date.now()}_${safeName}`, buffer);
      const logoUrl = brandingLogoUrl(tenant.slug);
      const [updated] = await db.update(tenantSettings)
        .set({
          brandingJson: { ...(before.brandingJson as object ?? {}), logoUrl },
          brandingExtendedJson: { ...(before.brandingExtendedJson as object ?? {}), logoFilePath: filePath },
          updatedAt: new Date(),
        })
        .where(eq(tenantSettings.tenantId, tenant.id))
        .returning();
      res.json({ success: true, data: { logoUrl, settings: updated } });
    } catch (e) { next(e); }
  },
);

router.get(
  "/branding/logo",
  ...guard,
  requirePermission("settings.view"),
  async (req, res, next) => {
    try {
      const tenant = (req as any).tenant;
      const [settings] = await db.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenant.id)).limit(1);
      const ext = (settings?.brandingExtendedJson ?? {}) as { logoFilePath?: string };
      if (!ext.logoFilePath) throw new NotFoundError("Logo not uploaded");
      const abs = resolveTenantFile(tenant.id, ext.logoFilePath);
      res.sendFile(abs);
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
      paymentProvidersJson: paymentProvidersBodySchema.optional(),
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
