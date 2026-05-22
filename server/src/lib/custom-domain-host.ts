import { normalizeHost } from "../services/tenant-resolve";

/** Compare request Host to stored custom domain (www and apex equivalent). */
export function hostMatchesTenantCustomDomain(
  stored: string | null | undefined,
  requestHost: string,
): boolean {
  if (!stored?.trim()) return false;
  const stripWww = (h: string) => normalizeHost(h).replace(/^www\./, "");
  return stripWww(stored) === stripWww(requestHost);
}

export function normalizeCustomDomainInput(domain: string): string {
  return domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .trim()
    .replace(/^www\./, "");
}
