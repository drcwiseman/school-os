/** Retired School OS host — rewrite to current site when opening links from platform UI. */
const LEGACY_HOST = /school\.bclimaxtech\.com/i;

export function normalizeAppUrl(url: string): string {
  if (!url?.trim()) return url;
  if (typeof window === "undefined") return url;
  try {
    const u = new URL(url, window.location.origin);
    if (LEGACY_HOST.test(u.host)) {
      return `${window.location.origin}${u.pathname}${u.search}${u.hash}`;
    }
    return u.href;
  } catch {
    if (LEGACY_HOST.test(url)) {
      return url.replace(/https?:\/\/[^/]+/i, window.location.origin);
    }
    return url;
  }
}

export function absoluteSchoolUrl(pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return normalizeAppUrl(pathOrUrl);
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}
