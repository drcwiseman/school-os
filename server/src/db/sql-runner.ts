/** Remove full-line and trailing `--` comments (keeps SQL inside strings untouched). */
export function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("--")) return "";
      const idx = line.indexOf("--");
      if (idx === -1) return line;
      return line.slice(0, idx).trimEnd();
    })
    .filter((line) => line.trim().length > 0)
    .join("\n")
    .trim();
}

/** @deprecated use stripSqlComments */
export function stripLeadingSqlComments(sql: string): string {
  return stripSqlComments(sql);
}

/** Split Drizzle migration SQL into executable statements. */
export function splitMigrationSql(content: string): string[] {
  const raw = content.includes("--> statement-breakpoint")
    ? content.split("--> statement-breakpoint")
    : [content];
  return raw.map(stripLeadingSqlComments).filter((s) => s.length > 0);
}
