import { Request } from "express";
import { eq, SQL } from "drizzle-orm";

/** Campus from header (preferred) or query — matches client CampusSelector */
export function getCampusId(req: Request): string | undefined {
  const header = req.headers["x-campus-id"];
  if (typeof header === "string" && header.length > 0) return header;
  const q = req.query.campusId;
  if (typeof q === "string" && q.length > 0) return q;
  return undefined;
}

export function campusCondition<T extends { campusId: unknown }>(
  table: T,
  campusId: string | undefined,
): SQL | undefined {
  if (!campusId) return undefined;
  return eq(table.campusId as any, campusId);
}

/** Push campus filter onto a conditions array when header/query campus is set */
export function pushCampusFilter<T extends { campusId: unknown }>(
  conditions: SQL[],
  table: T,
  req: Request,
): void {
  const c = campusCondition(table, getCampusId(req));
  if (c) conditions.push(c);
}
