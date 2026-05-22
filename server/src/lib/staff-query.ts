import { db } from "../db";
import { staff } from "../db/schema";
import { and, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";

type StaffColumnMeta = { hasDeletedAt: boolean; hasJobTitle: boolean; hasPhotoUrl: boolean };

let columnMeta: StaffColumnMeta | null = null;

export async function getStaffColumnMeta(): Promise<StaffColumnMeta> {
  if (columnMeta) return columnMeta;
  const result = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff'
  `);
  const cols = new Set(
    (result.rows as { column_name: string }[]).map((r) => r.column_name),
  );
  columnMeta = {
    hasDeletedAt: cols.has("deleted_at"),
    hasJobTitle: cols.has("job_title"),
    hasPhotoUrl: cols.has("photo_url"),
  };
  return columnMeta;
}

/** Columns safe to select even on lagging VPS schemas. */
export function staffSelectShape(meta: StaffColumnMeta) {
  const shape: Record<string, unknown> = {
    id: staff.id,
    tenantId: staff.tenantId,
    userId: staff.userId,
    employeeNo: staff.employeeNo,
    firstName: staff.firstName,
    lastName: staff.lastName,
    email: staff.email,
    department: staff.department,
    status: staff.status,
    hiredAt: staff.hiredAt,
    createdAt: staff.createdAt,
  };
  if (meta.hasJobTitle) shape.jobTitle = staff.jobTitle;
  if (meta.hasPhotoUrl) shape.photoUrl = staff.photoUrl;
  if (meta.hasDeletedAt) {
    shape.deletedAt = staff.deletedAt;
    shape.deletedBy = staff.deletedBy;
  }
  return shape;
}

export async function staffWhereActive(tenantId: string, extra: SQL[] = []) {
  const meta = await getStaffColumnMeta();
  const conditions: SQL[] = [eq(staff.tenantId, tenantId), ...extra];
  if (meta.hasDeletedAt) conditions.push(isNull(staff.deletedAt));
  return conditions;
}

export function teachingStaffFilter(meta: StaffColumnMeta): SQL {
  const parts: SQL[] = [
    ilike(staff.department, "%teacher%"),
    ilike(staff.department, "%teaching%"),
    ilike(staff.department, "%academic%"),
    ilike(staff.department, "%head%"),
    eq(staff.department, "Teacher"),
    eq(staff.department, "Headteacher"),
    eq(staff.department, "Teaching"),
  ];
  if (meta.hasJobTitle) {
    parts.push(eq(staff.jobTitle, "Teacher"), ilike(staff.jobTitle, "%teacher%"));
  }
  return or(...parts)!;
}

export async function listStaffForTenant(tenantId: string, opts?: { teachingOnly?: boolean }) {
  const meta = await getStaffColumnMeta();
  const extra: SQL[] = [];
  if (opts?.teachingOnly) extra.push(teachingStaffFilter(meta));
  return db
    .select(staffSelectShape(meta) as any)
    .from(staff)
    .where(and(...await staffWhereActive(tenantId, extra)))
    .orderBy(desc(staff.createdAt));
}

export async function getStaffById(tenantId: string, staffId: string) {
  const meta = await getStaffColumnMeta();
  const [row] = await db
    .select(staffSelectShape(meta) as any)
    .from(staff)
    .where(and(...await staffWhereActive(tenantId, [eq(staff.id, staffId)])))
    .limit(1);
  return row;
}
