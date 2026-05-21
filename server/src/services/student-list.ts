import { db } from "../db";
import { sql } from "drizzle-orm";

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

export async function listStudentsEnriched(filters: StudentListFilters): Promise<{ rows: EnrichedStudentRow[]; total: number }> {
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
}
