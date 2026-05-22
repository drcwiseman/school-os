export type TenantHostBootstrap = {
  slug: string;
  customDomain?: string | null;
  schoolName?: string;
};

declare global {
  interface Window {
    __SCHOOLOS_TENANT__?: TenantHostBootstrap;
  }
}

export function getTenantBootstrap(): TenantHostBootstrap | null {
  if (typeof window === "undefined") return null;
  const b = window.__SCHOOLOS_TENANT__;
  return b?.slug ? b : null;
}

/** True when the SPA was served on the school's verified custom domain (clean URLs). */
export function isVerifiedCustomDomainBrowse(): boolean {
  const boot = getTenantBootstrap();
  if (!boot?.customDomain) return false;
  const host = window.location.hostname.toLowerCase();
  const dom = boot.customDomain.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  const bare = host.replace(/^www\./, "");
  return bare === dom;
}

/** Staff/portal path prefix: empty on verified custom domain, else /s/:slug. */
export function schoolBasePath(slug: string): string {
  if (isVerifiedCustomDomainBrowse() && getTenantBootstrap()?.slug === slug) return "";
  return `/s/${slug}`;
}

export function schoolPath(slug: string, subpath: string): string {
  const base = schoolBasePath(slug);
  const p = subpath.startsWith("/") ? subpath : `/${subpath}`;
  return base ? `${base}${p}` : p;
}
