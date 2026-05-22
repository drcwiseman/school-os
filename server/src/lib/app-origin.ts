import { getPlatformMarketing } from "../services/platform-settings";

/** Canonical public app URL (SchoolOS on masomobest.com). */
export const DEFAULT_APP_ORIGIN = (
  process.env.DEFAULT_APP_ORIGIN?.trim() || "https://masomobest.com"
).replace(/\/$/, "");

/** Hostnames from the retired School OS subdomain deployment. */
export const LEGACY_APP_HOST_PATTERN = /(^|\.)school\.bclimaxtech\.com$/i;

export function isLegacyAppHost(host: string): boolean {
  return LEGACY_APP_HOST_PATTERN.test(host.replace(/^https?:\/\//i, "").split("/")[0] ?? "");
}

/** Rewrite old production URLs to the current app origin. */
export function normalizeAppOrigin(url: string | undefined | null): string {
  const raw = (url ?? "").trim();
  if (!raw) return DEFAULT_APP_ORIGIN;
  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (isLegacyAppHost(parsed.host)) {
      return DEFAULT_APP_ORIGIN;
    }
    return `${parsed.protocol}//${parsed.host}`.replace(/\/$/, "");
  } catch {
    if (/school\.bclimaxtech\.com/i.test(raw)) return DEFAULT_APP_ORIGIN;
    return raw.replace(/\/$/, "");
  }
}

/** Public app base URL for school links, impersonation, and portal redirects. */
export async function resolveClientOrigin(): Promise<string> {
  const fromEnv = process.env.CLIENT_ORIGIN?.trim();
  if (fromEnv) return normalizeAppOrigin(fromEnv);
  const marketing = await getPlatformMarketing();
  const fromMarketing = marketing.siteUrl?.trim();
  if (fromMarketing) return normalizeAppOrigin(fromMarketing);
  return DEFAULT_APP_ORIGIN;
}

export async function platformLoginPath(): Promise<string> {
  const base = await resolveClientOrigin();
  return `${base}/platform/login`;
}

export async function schoolLoginPath(slug: string): Promise<string> {
  const base = await resolveClientOrigin();
  return `${base}/s/${slug}/login`;
}

export async function portalLoginPath(slug: string): Promise<string> {
  const base = await resolveClientOrigin();
  return `${base}/s/${slug}/portal/login`;
}

export async function buildSchoolUrl(slug: string, subpath: string): Promise<string> {
  const base = await resolveClientOrigin();
  const path = subpath.startsWith("/") ? subpath : `/${subpath}`;
  return `${base}/s/${slug}${path}`;
}
