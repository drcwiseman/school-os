import crypto from "crypto";
import { db } from "../db";
import { tenants } from "../db/schema";
import { eq } from "drizzle-orm";
import { getTenantPublicUrls } from "../lib/school-urls";
import { ConflictError } from "../middleware/error";

const VERIFY_PREFIX = "_schoolos-verify";

export function buildVerificationHost(domain: string) {
  return `${VERIFY_PREFIX}.${domain}`;
}

export function buildVerificationToken(tenantId: string) {
  return crypto.createHash("sha256").update(`${tenantId}-${process.env.SESSION_SECRET ?? "dev"}`).digest("hex").slice(0, 32);
}

import { normalizeCustomDomainInput } from "../lib/custom-domain-host";

export async function setCustomDomain(tenantId: string, domain: string) {
  const normalized = normalizeCustomDomainInput(domain);
  if (!normalized || normalized.includes(" ") || !normalized.includes(".")) {
    throw new ConflictError("Enter a valid hostname (e.g. portal.yourschool.edu)");
  }
  const token = buildVerificationToken(tenantId);
  const [updated] = await db
    .update(tenants)
    .set({
      customDomain: normalized,
      domainVerified: false,
      sslConfig: {
        status: "pending_verification",
        verificationToken: token,
        verificationHost: buildVerificationHost(normalized),
        challengeType: "dns-txt",
      },
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId))
    .returning();
  return updated;
}

/** Mark domain verified manually (platform override when DNS already correct). */
export async function verifyCustomDomain(tenantId: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant?.customDomain) return null;

  const [updated] = await db
    .update(tenants)
    .set({
      domainVerified: true,
      sslConfig: {
        ...(tenant.sslConfig as object),
        status: "verified",
        verifiedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId))
    .returning();
  return updated;
}

export async function getDomainInstructions(tenant: typeof tenants.$inferSelect) {
  const ssl = (tenant.sslConfig ?? {}) as Record<string, string>;
  const token = ssl.verificationToken ?? buildVerificationToken(tenant.id);
  const domain = tenant.customDomain ?? "";
  const urls = await getTenantPublicUrls(tenant);

  return {
    customDomain: domain,
    domainVerified: tenant.domainVerified,
    subdomain: tenant.subdomain ?? tenant.slug,
    suggestedSubdomainUrl: urls.suggestedSubdomainUrl,
    dnsTxtRecord: domain
      ? { host: buildVerificationHost(domain), value: token }
      : null,
    dnsRecords: {
      cname: domain ? { host: domain, value: urls.ingress.cnameTarget } : null,
      aRecord: urls.ingress.aRecordIp ? { host: domain, value: urls.ingress.aRecordIp } : null,
    },
    sslStatus: ssl.status ?? "pending",
    urls: {
      platform: urls.platform,
      custom: urls.custom,
      recommendedStaffLogin: urls.custom?.staffLogin ?? urls.platform.staffLogin,
      recommendedPortalLogin: urls.custom?.portalLogin ?? urls.platform.portalLogin,
    },
  };
}
