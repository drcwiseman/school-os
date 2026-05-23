/** Parse HH:MM or HH:MM:SS to minutes from midnight */
export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const parts = value.trim().split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function timeRangesOverlap(
  aStart: string | null | undefined,
  aEnd: string | null | undefined,
  bStart: string | null | undefined,
  bEnd: string | null | undefined,
): boolean {
  const as = parseTimeToMinutes(aStart);
  const ae = parseTimeToMinutes(aEnd);
  const bs = parseTimeToMinutes(bStart);
  const be = parseTimeToMinutes(bEnd);
  if (as == null || ae == null || bs == null || be == null) return false;
  return as < be && bs < ae;
}

export type TimetableConflict = {
  type: "teacher" | "room" | "class" | "period";
  severity: "error" | "warn";
  detail: string;
  periodIds?: string[];
};

export function detectPeriodConflicts(
  periods: Array<{
    id: string;
    dayOfWeek: number;
    periodNo: number;
    startTime?: string | null;
    endTime?: string | null;
    teacherUserId?: string | null;
    roomId?: string | null;
    classId?: string | null;
    className?: string | null;
    timetableName?: string | null;
  }>,
): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];
  for (let i = 0; i < periods.length; i++) {
    for (let j = i + 1; j < periods.length; j++) {
      const a = periods[i];
      const b = periods[j];
      if (a.dayOfWeek !== b.dayOfWeek) continue;

      const samePeriodNo = a.periodNo === b.periodNo;
      const timeOverlap = timeRangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime);
      if (!samePeriodNo && !timeOverlap) continue;

      const label = timeOverlap
        ? `Time overlap ${a.startTime ?? "?"}–${a.endTime ?? "?"} on day ${a.dayOfWeek}`
        : `Period ${a.periodNo} clash on day ${a.dayOfWeek}`;

      if (a.teacherUserId && b.teacherUserId && a.teacherUserId === b.teacherUserId) {
        conflicts.push({
          type: "teacher",
          severity: "error",
          detail: `Teacher double-booked: ${label}`,
          periodIds: [a.id, b.id],
        });
      }
      if (a.roomId && b.roomId && a.roomId === b.roomId) {
        conflicts.push({
          type: "room",
          severity: "error",
          detail: `Room double-booked: ${label}`,
          periodIds: [a.id, b.id],
        });
      }
      if (a.classId && b.classId && a.classId === b.classId && (samePeriodNo || timeOverlap)) {
        conflicts.push({
          type: "class",
          severity: "error",
          detail: `Class ${a.className ?? a.classId} has overlapping slots: ${label}`,
          periodIds: [a.id, b.id],
        });
      }
    }
  }
  return conflicts;
}
