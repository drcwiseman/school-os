import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { timetablePeriods, timetables } from "../db/schema";
import { BadRequestError } from "../middleware/error";
import { detectPeriodConflicts } from "./timetable-conflicts";

export type GenerationRules = {
  daysOfWeek: number[];
  periodsPerDay: number;
  startTime: string;
  periodDurationMinutes: number;
  breakAfterPeriod?: number;
  breakDurationMinutes?: number;
  subjects: Array<{
    subjectId: string;
    teacherUserId?: string;
    roomId?: string;
    periodsPerWeek: number;
  }>;
};

function addMinutesToTime(start: string, addMin: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + addMin;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export async function generateTeachingTimetable(
  tenantId: string,
  timetableId: string,
  rules: GenerationRules,
) {
  const [tt] = await db.select().from(timetables).where(and(
    eq(timetables.id, timetableId),
    eq(timetables.tenantId, tenantId),
  )).limit(1);
  if (!tt) throw new BadRequestError("Timetable not found");

  const days = rules.daysOfWeek?.length ? rules.daysOfWeek : [1, 2, 3, 4, 5];
  const periodsPerDay = Math.max(1, rules.periodsPerDay ?? 8);
  const duration = Math.max(15, rules.periodDurationMinutes ?? 40);
  const breakAfter = rules.breakAfterPeriod ?? 0;
  const breakDur = rules.breakDurationMinutes ?? 20;

  const slots: Array<{
    dayOfWeek: number;
    periodNo: number;
    startTime: string;
    endTime: string;
  }> = [];

  for (const day of days) {
    let cursor = rules.startTime ?? "08:00";
    for (let p = 1; p <= periodsPerDay; p++) {
      const end = addMinutesToTime(cursor, duration);
      slots.push({ dayOfWeek: day, periodNo: p, startTime: cursor, endTime: end });
      cursor = end;
      if (breakAfter > 0 && p === breakAfter) {
        cursor = addMinutesToTime(cursor, breakDur);
      }
    }
  }

  const subjectQueue: Array<{ subjectId: string; teacherUserId?: string; roomId?: string }> = [];
  for (const sub of rules.subjects ?? []) {
    for (let i = 0; i < (sub.periodsPerWeek ?? 1); i++) {
      subjectQueue.push({
        subjectId: sub.subjectId,
        teacherUserId: sub.teacherUserId,
        roomId: sub.roomId,
      });
    }
  }
  if (!subjectQueue.length) throw new BadRequestError("Add at least one subject with periods per week");

  await db.delete(timetablePeriods).where(and(
    eq(timetablePeriods.timetableId, timetableId),
    eq(timetablePeriods.tenantId, tenantId),
  ));

  const inserted: typeof timetablePeriods.$inferSelect[] = [];
  let qi = 0;
  for (const slot of slots) {
    const sub = subjectQueue[qi % subjectQueue.length];
    qi++;
    const [row] = await db.insert(timetablePeriods).values({
      tenantId,
      timetableId,
      dayOfWeek: slot.dayOfWeek,
      periodNo: slot.periodNo,
      subjectId: sub.subjectId,
      teacherUserId: sub.teacherUserId ?? null,
      roomId: sub.roomId ?? null,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }).returning();
    inserted.push(row);
  }

  await db.update(timetables).set({
    generationRulesJson: rules as unknown as Record<string, unknown>,
  }).where(eq(timetables.id, timetableId));

  const conflicts = detectPeriodConflicts(inserted.map((p) => ({
    id: p.id,
    dayOfWeek: p.dayOfWeek,
    periodNo: p.periodNo,
    startTime: p.startTime,
    endTime: p.endTime,
    teacherUserId: p.teacherUserId,
    roomId: p.roomId,
    classId: tt.classId,
  })));

  return { periods: inserted, conflicts };
}
