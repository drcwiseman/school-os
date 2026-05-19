import { db } from "../db";
import { tenants } from "../db/schema";
import { and, eq } from "drizzle-orm";

function normalizeHost(host: string): string {
  return host.split(":")[0].toLowerCase().trim();
}

/** Platform apex hostnames — not school subdomains. */
export function getPlatformHosts(): string[] {
  const base = process.env.PLATFORM_DOMAIN || process.env.CLIENT_ORIGIN?.replace(/^https?:\/\//, "") || "";
  const hosts = ["localhost", "127.0.0.1"];
  if (base) hosts.push(normalizeHost(base));
  return hosts;
}

export function isPlatformHost(host: string): boolean {
  const h = normalizeHost(host);
  return getPlatformHosts().some((p) => h === p || h === `www.${p}`);
}

/**
 * Resolve school from Host header: custom domain (verified) → subdomain → null.
 */
export async function resolveTenantByHost(hostHeader: string) {
  const host = normalizeHost(hostHeader);
  if (!host || isPlatformHost(host)) return null;

  const [byCustom] = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.customDomain, host), eq(tenants.domainVerified, true)))
    .limit(1);
  if (byCustom) return byCustom;

  const parts = host.split(".");
  if (parts.length >= 3) {
    const sub = parts[0];
    if (sub && sub !== "www") {
      const [bySub] = await db.select().from(tenants).where(eq(tenants.subdomain, sub)).limit(1);
      if (bySub) return bySub;
      const [bySlug] = await db.select().from(tenants).where(eq(tenants.slug, sub)).limit(1);
      if (bySlug) return bySlug;
    }
  }

  return null;
}

export async function resolveTenantBySlug(slug: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return tenant ?? null;
}
