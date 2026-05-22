import dns from "dns";
import { promisify } from "util";
import { db } from "../db";
import { tenants } from "../db/schema";
import { eq } from "drizzle-orm";

const resolveCname = promisify(dns.resolveCname);
const resolveA = promisify(dns.resolve4);

export async function verifyDomainDns(tenantId: string, customDomain: string): Promise<{
  verified: boolean;
  cnameMatched: boolean;
  aRecordMatched: boolean;
  error?: string;
}> {
  try {
    // 1. Resolve CNAME pointing to ingress.schoolos.com
    const cnames = await resolveCname(customDomain).catch(() => [] as string[]);
    const ingressHost = process.env.INGRESS_CNAME_TARGET ?? process.env.PLATFORM_DOMAIN ?? "masomobest.com";
    const cnameMatched = cnames.some(
      (c) => c === ingressHost || c.endsWith(`.${ingressHost}`) || c.endsWith(ingressHost),
    );

    // 2. Resolve A records pointing to our server IP
    const aRecords = await resolveA(customDomain).catch(() => [] as string[]);
    const targetIp = process.env.INGRESS_IP ?? "173.231.241.161";
    const aRecordMatched = aRecords.includes(targetIp);

    const verified = cnameMatched || aRecordMatched;

    if (verified) {
      await db
        .update(tenants)
        .set({
          domainVerified: true,
          sslConfig: {
            status: "active",
            certificateIssuedAt: new Date().toISOString(),
            challengeType: "http-01",
            provider: "lets_encrypt_v2"
          },
          updatedAt: new Date()
        })
        .where(eq(tenants.id, tenantId));
    }

    return {
      verified,
      cnameMatched,
      aRecordMatched,
    };
  } catch (err: any) {
    return {
      verified: false,
      cnameMatched: false,
      aRecordMatched: false,
      error: err.message,
    };
  }
}
