import crypto from "crypto";
import { db } from "../db";
import { tenants } from "../db/schema";
import { eq } from "drizzle-orm";

const VERIFY_PREFIX = "_schoolos-verify";

export function buildVerificationHost(domain: string) {
  return `${VERIFY_PREFIX}.${domain}`;
}

export function buildVerificationToken(tenantId: string) {
  return crypto.createHash("sha256").update(`${tenantId}-${process.env.SESSION_SECRET ?? "dev"}`).digest("hex").slice(0, 32);
}

export async function setCustomDomain(tenantId: string, domain: string) {
  const normalized = domain.toLowerCase().replace(/^https?:\/\//, "").split("/")[0].trim();
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

/** Mark domain verified (DNS TXT check can be wired later; manual verify for Phase 16). */
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

export function getDomainInstructions(tenant: typeof tenants.$inferSelect) {
  const ssl = (tenant.sslConfig ?? {}) as Record<string, string>;
  const token = ssl.verificationToken ?? buildVerificationToken(tenant.id);
  const domain = tenant.customDomain ?? "";
  return {
    customDomain: domain,
    domainVerified: tenant.domainVerified,
    subdomain: tenant.subdomain ?? tenant.slug,
    suggestedSubdomainUrl: tenant.subdomain
      ? `https://${tenant.subdomain}.${process.env.PLATFORM_DOMAIN ?? "schoolos.local"}`
      : null,
    dnsTxtRecord: {
      host: buildVerificationHost(domain),
      value: token,
    },
    sslStatus: ssl.status ?? "pending",
  };
}
