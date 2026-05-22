import { db } from "../db";
import { students } from "../db/schema";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

export type EnrichedStudentRow = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  gender: string | null;
  status: string;
  photoUrl: string | null;
  classId: string | null;
  className: string | null;
  streamId: string | null;
  streamName: string | null;
  primaryParentName: string | null;
  primaryParentPhone: string | null;
  address: string | null;
};

export type StudentListFilters = {
  tenantId: string;
  campusId?: string;
  search?: string;
  roll?: string;
  name?: string;
  classId?: string;
  status?: string;
  limit: number;
  offset: number;
};

function buildWhere(filters: StudentListFilters) {
  const parts = [sql`s.tenant_id = ${filters.tenantId}`, sql`s.deleted_at IS NULL`];
  if (filters.campusId) parts.push(sql`s.campus_id = ${filters.campusId}`);
  if (filters.status) parts.push(sql`s.status = ${filters.status}`);
  if (filters.roll) parts.push(sql`s.admission_number ILIKE ${"%" + filters.roll + "%"}`);
  if (filters.name) {
    const n = "%" + filters.name + "%";
    parts.push(sql`(s.first_name ILIKE ${n} OR s.last_name ILIKE ${n} OR (s.first_name || ' ' || s.last_name) ILIKE ${n})`);
  }
  if (filters.search) {
    const s = "%" + filters.search + "%";
    parts.push(sql`(s.first_name ILIKE ${s} OR s.last_name ILIKE ${s} OR s.admission_number ILIKE ${s})`);
  }
  if (filters.classId) parts.push(sql`cc.class_id = ${filters.classId}`);
  return sql.join(parts, sql` AND `);
}

const selectCols = sql`
  s.id,
  s.admission_number AS "admissionNumber",
  s.first_name AS "firstName",
  s.last_name AS "lastName",
  s.middle_name AS "middleName",
  s.gender,
  s.status,
  s.photo_url AS "photoUrl",
  cc.class_id AS "classId",
  c.name AS "className",
  cc.stream_id AS "streamId",
  st.name AS "streamName",
  CASE WHEN g.id IS NOT NULL THEN trim(g.first_name || ' ' || g.last_name) ELSE NULL END AS "primaryParentName",
  g.phone AS "primaryParentPhone",
  COALESCE(s.address, g.address) AS address
`;

const joins = sql`
  FROM students s
  LEFT JOIN LATERAL (
    SELECT sch.class_id, sch.stream_id
    FROM student_class_history sch
    WHERE sch.student_id = s.id AND sch.tenant_id = s.tenant_id AND sch.to_date IS NULL
    ORDER BY sch.from_date DESC
    LIMIT 1
  ) cc ON true
  LEFT JOIN classes c ON c.id = cc.class_id
  LEFT JOIN streams st ON st.id = cc.stream_id
  LEFT JOIN student_guardians sg ON sg.student_id = s.id AND sg.is_primary = true
  LEFT JOIN guardians g ON g.id = sg.guardian_id
`;

async function listStudentsSimple(filters: StudentListFilters): Promise<{ rows: EnrichedStudentRow[]; total: number }> {
  const conditions = [eq(students.tenantId, filters.tenantId), isNull(students.deletedAt)];
  if (filters.campusId) conditions.push(eq(students.campusId, filters.campusId));
  if (filters.status) conditions.push(eq(students.status, filters.status as "active"));
  if (filters.roll) conditions.push(ilike(students.admissionNumber, `%${filters.roll}%`));
  if (filters.name) {
    const n = `%${filters.name}%`;
    conditions.push(or(ilike(students.firstName, n), ilike(students.lastName, n))!);
  }
  if (filters.search) {
    const s = `%${filters.search}%`;
    conditions.push(or(ilike(students.firstName, s), ilike(students.lastName, s), ilike(students.admissionNumber, s))!);
  }
  const where = and(...conditions);
  const rows = await db.select({
    id: students.id,
    admissionNumber: students.admissionNumber,
    firstName: students.firstName,
    lastName: students.lastName,
    middleName: students.middleName,
    gender: students.gender,
    status: students.status,
    photoUrl: students.photoUrl,
  }).from(students).where(where).orderBy(desc(students.createdAt)).limit(filters.limit).offset(filters.offset);
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(students).where(where);
  const mapped: EnrichedStudentRow[] = rows.map((r) => ({
    ...r,
    gender: r.gender ?? null,
    status: r.status,
    classId: null,
    className: null,
    streamId: null,
    streamName: null,
    primaryParentName: null,
    primaryParentPhone: null,
    address: null,
  }));
  return { rows: mapped, total: Number(count) };
}

export async function listStudentsEnriched(filters: StudentListFilters): Promise<{ rows: EnrichedStudentRow[]; total: number }> {
  try {
    const where = buildWhere(filters);

    const rowsRes = await db.execute(sql`
      SELECT ${selectCols}
      ${joins}
      WHERE ${where}
      ORDER BY s.created_at DESC
      LIMIT ${filters.limit} OFFSET ${filters.offset}
    `);

    const countRes = await db.execute(sql`
      SELECT count(*)::int AS cnt
      ${joins}
      WHERE ${where}
    `);

    const list = (rowsRes.rows ?? rowsRes) as EnrichedStudentRow[];
    const cntRow = (countRes.rows ?? countRes)[0] as { cnt?: number } | undefined;
    return { rows: list, total: Number(cntRow?.cnt ?? 0) };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    const msg = (err as Error).message ?? "";
    if (code === "42703" || code === "42P01" || msg.includes("does not exist")) {
      console.warn("[listStudentsEnriched] fallback to simple list:", msg.slice(0, 120));
      return listStudentsSimple(filters);
    }
    throw err;
  }
}
