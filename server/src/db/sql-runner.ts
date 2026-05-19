/** Strip leading line comments so blocks are not skipped when the file starts with `--`. */
export function stripLeadingSqlComments(sql: string): string {
  const lines = sql.split("\n");
  let i = 0;
  while (i < lines.length && /^\s*--/.test(lines[i])) i++;
  return lines.slice(i).join("\n").trim();
}

/** Split Drizzle migration SQL into executable statements. */
export function splitMigrationSql(content: string): string[] {
  const raw = content.includes("--> statement-breakpoint")
    ? content.split("--> statement-breakpoint")
    : [content];
  return raw.map(stripLeadingSqlComments).filter((s) => s.length > 0);
}
