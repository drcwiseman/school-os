import { db } from "../db";
import {
  curriculumFrameworks, curriculumUnits, curriculumCompetencies, curriculumOutcomes,
  studentCompetencyTracking, curriculumCrossLinks, gradingScales, curriculumPacks,
  subjects, classes,
} from "../db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { getTableColumns, tableExists } from "./table-columns";

export function frameworkSelectShape(cols: Set<string>) {
  const shape: Record<string, unknown> = {
    id: curriculumFrameworks.id,
    tenantId: curriculumFrameworks.tenantId,
    code: curriculumFrameworks.code,
    name: curriculumFrameworks.name,
    createdAt: curriculumFrameworks.createdAt,
  };
  if (cols.has("exam_board")) shape.examBoard = curriculumFrameworks.examBoard;
  if (cols.has("version")) shape.version = curriculumFrameworks.version;
  if (cols.has("active")) shape.active = curriculumFrameworks.active;
  if (cols.has("settings_json")) shape.settingsJson = curriculumFrameworks.settingsJson;
  return shape;
}

export async function listCurriculumFrameworks(tenantId: string) {
  if (!(await tableExists("curriculum_frameworks"))) return [];
  const cols = await getTableColumns("curriculum_frameworks");
  const orderCol = cols.has("created_at") ? curriculumFrameworks.createdAt : curriculumFrameworks.id;
  return db
    .select(frameworkSelectShape(cols) as any)
    .from(curriculumFrameworks)
    .where(eq(curriculumFrameworks.tenantId, tenantId))
    .orderBy(desc(orderCol));
}

export async function getCurriculumFrameworkById(tenantId: string, id: string) {
  if (!(await tableExists("curriculum_frameworks"))) return null;
  const cols = await getTableColumns("curriculum_frameworks");
  const [row] = await db
    .select(frameworkSelectShape(cols) as any)
    .from(curriculumFrameworks)
    .where(and(eq(curriculumFrameworks.id, id), eq(curriculumFrameworks.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function insertCurriculumFramework(
  tenantId: string,
  data: { code: string; name: string; examBoard?: string; version?: string; active?: boolean; settingsJson?: Record<string, unknown> },
) {
  if (!(await tableExists("curriculum_frameworks"))) {
    throw new Error("curriculum_frameworks table is missing — run npm run db:repair --prefix server");
  }
  const cols = await getTableColumns("curriculum_frameworks");
  const values: Record<string, unknown> = { tenantId, code: data.code, name: data.name };
  if (cols.has("exam_board")) values.examBoard = data.examBoard ?? null;
  if (cols.has("version")) values.version = data.version ?? "1.0";
  if (cols.has("active")) values.active = data.active ?? true;
  if (cols.has("settings_json")) values.settingsJson = data.settingsJson ?? {};
  const [inserted] = await db.insert(curriculumFrameworks).values(values as any).returning({ id: curriculumFrameworks.id });
  return getCurriculumFrameworkById(tenantId, inserted.id);
}

export async function listCurriculumUnits(tenantId: string, frameworkId?: string) {
  if (!(await tableExists("curriculum_units"))) return [];
  const cols = await getTableColumns("curriculum_units");
  const shape: Record<string, unknown> = {
    id: curriculumUnits.id,
    title: curriculumUnits.title,
    frameworkId: curriculumUnits.frameworkId,
  };
  if (cols.has("tenant_id")) shape.tenantId = curriculumUnits.tenantId;
  if (cols.has("order_no")) shape.orderNo = curriculumUnits.orderNo;
  if (cols.has("subject_id")) shape.subjectId = curriculumUnits.subjectId;
  if (cols.has("class_id")) shape.classId = curriculumUnits.classId;
  if (cols.has("term_id")) shape.termId = curriculumUnits.termId;

  const conditions = [eq(curriculumUnits.tenantId, tenantId)];
  if (frameworkId) conditions.push(eq(curriculumUnits.frameworkId, frameworkId));

  const joinSubjects = cols.has("subject_id") && (await tableExists("subjects"));
  const joinClasses = cols.has("class_id") && (await tableExists("classes"));
  const selectShape: Record<string, unknown> = { ...shape };
  if (joinSubjects) selectShape.subjectName = subjects.name;
  if (joinClasses) selectShape.className = classes.name;

  const order = cols.has("order_no") ? curriculumUnits.orderNo : curriculumUnits.title;
  if (joinSubjects && joinClasses) {
    return db.select(selectShape as any).from(curriculumUnits)
      .leftJoin(subjects, eq(curriculumUnits.subjectId, subjects.id))
      .leftJoin(classes, eq(curriculumUnits.classId, classes.id))
      .where(and(...conditions))
      .orderBy(order);
  }
  if (joinSubjects) {
    return db.select(selectShape as any).from(curriculumUnits)
      .leftJoin(subjects, eq(curriculumUnits.subjectId, subjects.id))
      .where(and(...conditions))
      .orderBy(order);
  }
  return db.select(shape as any).from(curriculumUnits).where(and(...conditions)).orderBy(order);
}

export async function listCurriculumCompetencies(tenantId: string, frameworkId?: string) {
  if (!(await tableExists("curriculum_competencies"))) return [];
  const cols = await getTableColumns("curriculum_competencies");
  const shape: Record<string, unknown> = {
    id: curriculumCompetencies.id,
    tenantId: curriculumCompetencies.tenantId,
    frameworkId: curriculumCompetencies.frameworkId,
    code: curriculumCompetencies.code,
    name: curriculumCompetencies.name,
  };
  if (cols.has("description")) shape.description = curriculumCompetencies.description;
  const conditions = [eq(curriculumCompetencies.tenantId, tenantId)];
  if (frameworkId) conditions.push(eq(curriculumCompetencies.frameworkId, frameworkId));
  return db.select(shape as any).from(curriculumCompetencies).where(and(...conditions));
}

export async function listCurriculumOutcomes(tenantId: string, unitId?: string) {
  if (!(await tableExists("curriculum_outcomes"))) return [];
  const cols = await getTableColumns("curriculum_outcomes");
  const shape: Record<string, unknown> = {
    id: curriculumOutcomes.id,
    tenantId: curriculumOutcomes.tenantId,
    unitId: curriculumOutcomes.unitId,
    description: curriculumOutcomes.description,
  };
  if (cols.has("competency_id")) shape.competencyId = curriculumOutcomes.competencyId;
  if (cols.has("order_no")) shape.orderNo = curriculumOutcomes.orderNo;
  const conditions = [eq(curriculumOutcomes.tenantId, tenantId)];
  if (unitId) conditions.push(eq(curriculumOutcomes.unitId, unitId));
  const order = cols.has("order_no") ? curriculumOutcomes.orderNo : curriculumOutcomes.id;
  return db.select(shape as any).from(curriculumOutcomes).where(and(...conditions)).orderBy(order);
}

export async function curriculumAnalytics(tenantId: string) {
  let units = 0;
  let competencies = 0;
  let studentsTracked = 0;
  const byLevel: { level: string; count: number }[] = [];

  if (await tableExists("curriculum_units")) {
    const [r] = await db.select({ count: sql<number>`count(*)::int` }).from(curriculumUnits).where(eq(curriculumUnits.tenantId, tenantId));
    units = Number(r?.count ?? 0);
  }
  if (await tableExists("curriculum_competencies")) {
    const [r] = await db.select({ count: sql<number>`count(*)::int` }).from(curriculumCompetencies).where(eq(curriculumCompetencies.tenantId, tenantId));
    competencies = Number(r?.count ?? 0);
  }
  if (await tableExists("student_competency_tracking")) {
    const [r] = await db.select({ count: sql<number>`count(distinct ${studentCompetencyTracking.studentId})::int` })
      .from(studentCompetencyTracking).where(eq(studentCompetencyTracking.tenantId, tenantId));
    studentsTracked = Number(r?.count ?? 0);
    const rows = await db.select({
      level: studentCompetencyTracking.level,
      count: sql<number>`count(*)::int`,
    }).from(studentCompetencyTracking).where(eq(studentCompetencyTracking.tenantId, tenantId)).groupBy(studentCompetencyTracking.level);
    for (const row of rows) byLevel.push({ level: row.level, count: Number(row.count) });
  }

  return { units, competencies, studentsTracked, byLevel };
}

export async function curriculumTablesReady(): Promise<boolean> {
  return tableExists("curriculum_frameworks");
}
