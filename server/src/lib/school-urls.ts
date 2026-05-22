import { resolveClientOrigin } from "./app-origin";

export type TenantUrlSource = {
  slug: string;
  customDomain?: string | null;
  domainVerified?: boolean;
  subdomain?: string | null;
};

/** Paths always include /s/:slug (works on platform host and custom domain). */
export function schoolPaths(slug: string) {
  const base = `/s/${slug}`;
  return {
    staffLogin: `${base}/login`,
    staffDashboard: `${base}/dashboard`,
    portalLogin: `${base}/portal/login`,
    portalDashboard: `${base}/portal/dashboard`,
    apply: `${base}/apply`,
  };
}

/** Clean paths on a verified custom domain (no /s/:slug in the browser). */
export function customDomainCleanPaths() {
  return {
    staffLogin: "/login",
    staffDashboard: "/dashboard",
    portalLogin: "/portal/login",
    portalDashboard: "/portal/dashboard",
    apply: "/apply",
  };
}

export async function getTenantPublicUrls(tenant: TenantUrlSource) {
  const platformOrigin = await resolveClientOrigin();
  const paths = schoolPaths(tenant.slug);
  const platform = {
    origin: platformOrigin,
    staffLogin: `${platformOrigin}${paths.staffLogin}`,
    portalLogin: `${platformOrigin}${paths.portalLogin}`,
    staffDashboard: `${platformOrigin}${paths.staffDashboard}`,
  };

  const ingressHost = process.env.INGRESS_CNAME_TARGET ?? process.env.PLATFORM_DOMAIN ?? "masomobest.com";
  const ingressIp = process.env.INGRESS_IP ?? "";

  const domain = (tenant.customDomain ?? "").trim().toLowerCase();
  const verified = Boolean(tenant.domainVerified && domain);

  let custom: {
    origin: string;
    staffLogin: string;
    portalLogin: string;
    staffDashboard: string;
    clean: ReturnType<typeof customDomainCleanPaths>;
  } | null = null;

  if (domain) {
    const origin = `https://${domain}`;
    const clean = customDomainCleanPaths();
    custom = {
      origin,
      staffLogin: verified ? `${origin}${clean.staffLogin}` : `${origin}${paths.staffLogin}`,
      portalLogin: verified ? `${origin}${clean.portalLogin}` : `${origin}${paths.portalLogin}`,
      staffDashboard: verified ? `${origin}${clean.staffDashboard}` : `${origin}${paths.staffDashboard}`,
      clean,
    };
  }

  const sub = tenant.subdomain ?? tenant.slug;
  const platformDomain = process.env.PLATFORM_DOMAIN ?? new URL(platformOrigin).host;
  const suggestedSubdomainUrl = sub ? `https://${sub}.${platformDomain}` : null;

  return {
    slug: tenant.slug,
    paths,
    platform,
    custom,
    verified,
    ingress: { cnameTarget: ingressHost, aRecordIp: ingressIp },
    suggestedSubdomainUrl,
  };
}
