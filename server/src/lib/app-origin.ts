import { getPlatformMarketing } from "../services/platform-settings";

/** Public app base URL for school links and impersonation redirects. */
export async function resolveClientOrigin(): Promise<string> {
  const fromEnv = process.env.CLIENT_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const marketing = await getPlatformMarketing();
  const fromMarketing = marketing.siteUrl?.trim();
  if (fromMarketing) return fromMarketing.replace(/\/$/, "");
  return "";
}

export async function schoolLoginPath(slug: string): Promise<string> {
  const base = await resolveClientOrigin();
  const path = `/s/${slug}/login`;
  return base ? `${base}${path}` : path;
}
