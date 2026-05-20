/** Client-side preview of server slugify (keep in sync with server/src/lib/slug.ts). */
export function slugifySchoolName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base.length >= 2 ? base : "school";
}
