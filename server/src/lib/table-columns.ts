import { db } from "../db";
import { sql } from "drizzle-orm";

const cache = new Map<string, Set<string>>();

export async function getTableColumns(tableName: string): Promise<Set<string>> {
  const cached = cache.get(tableName);
  if (cached) return cached;
  const result = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${tableName}
  `);
  const cols = new Set((result.rows as { column_name: string }[]).map((r) => r.column_name));
  cache.set(tableName, cols);
  return cols;
}

export async function tableExists(tableName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${tableName}
    LIMIT 1
  `);
  return (result.rows as unknown[]).length > 0;
}
