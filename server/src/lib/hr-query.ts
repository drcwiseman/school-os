import { db } from "../db";
import { leaveRequests, staff, staffAttendance, staffContracts } from "../db/schema";
import { and, desc, eq, gte, isNull, lte, sql, type SQL } from "drizzle-orm";
import { tableExists } from "./table-columns";
import { getStaffById, listStaffForTenant } from "./staff-query";

export type HrTablesReady = {
  contracts: boolean;
  leave: boolean;
  attendance: boolean;
};

let tablesCache: HrTablesReady | null = null;

export async function getHrTablesReady(): Promise<HrTablesReady> {
  if (tablesCache) return tablesCache;
  const [contracts, leave, attendance] = await Promise.all([
    tableExists("staff_contracts"),
    tableExists("leave_requests"),
    tableExists("staff_attendance"),
  ]);
  tablesCache = { contracts, leave, attendance };
  return tablesCache;
}

export function resetHrTablesCache() {
  tablesCache = null;
}

export async function listLeaveForTenant(tenantId: string, statusFilter?: string) {
  if (!(await tableExists("leave_requests"))) return [];
  const conditions: SQL[] = [eq(leaveRequests.tenantId, tenantId)];
  if (statusFilter) conditions.push(eq(leaveRequests.status, statusFilter as "pending" | "approved" | "rejected" | "cancelled"));
  return db
    .select({
      id: leaveRequests.id,
      staffId: leaveRequests.staffId,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      reason: leaveRequests.reason,
      status: leaveRequests.status,
      createdAt: leaveRequests.createdAt,
      staffFirstName: staff.firstName,
      staffLastName: staff.lastName,
      employeeNo: staff.employeeNo,
    })
    .from(leaveRequests)
    .innerJoin(staff, eq(leaveRequests.staffId, staff.id))
    .where(and(...conditions))
    .orderBy(desc(leaveRequests.createdAt));
}

export async function listContractsForStaff(tenantId: string, staffId: string) {
  if (!(await tableExists("staff_contracts"))) return [];
  return db
    .select()
    .from(staffContracts)
    .where(and(eq(staffContracts.tenantId, tenantId), eq(staffContracts.staffId, staffId)))
    .orderBy(desc(staffContracts.startDate));
}

export async function getHrDashboard(tenantId: string) {
  const staffRows = await listStaffForTenant(tenantId);
  const activeStaff = staffRows.filter((s: { status?: string }) => (s.status ?? "active") === "active").length;
  const today = new Date().toISOString().slice(0, 10);

  let attendanceToday = { present: 0, absent: 0, late: 0 };
  if (await tableExists("staff_attendance")) {
    const [att] = await db
      .select({
        present: sql<number>`count(*) filter (where ${staffAttendance.status} = 'present')`,
        absent: sql<number>`count(*) filter (where ${staffAttendance.status} = 'absent')`,
        late: sql<number>`count(*) filter (where ${staffAttendance.status} = 'late')`,
      })
      .from(staffAttendance)
      .where(and(eq(staffAttendance.tenantId, tenantId), eq(staffAttendance.date, today)));
    attendanceToday = {
      present: Number(att?.present ?? 0),
      absent: Number(att?.absent ?? 0),
      late: Number(att?.late ?? 0),
    };
  }

  let pendingLeave = 0;
  if (await tableExists("leave_requests")) {
    const [row] = await db
      .select({ n: sql<number>`count(*)` })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.tenantId, tenantId), eq(leaveRequests.status, "pending")));
    pendingLeave = Number(row?.n ?? 0);
  }

  return { activeStaff, attendanceToday, pendingLeave };
}

function toStaffRow(s: Record<string, unknown>) {
  return {
    id: String(s.id),
    employeeNo: String(s.employeeNo ?? ""),
    firstName: String(s.firstName ?? ""),
    lastName: String(s.lastName ?? ""),
    department: s.department != null ? String(s.department) : undefined,
    jobTitle: s.jobTitle != null ? String(s.jobTitle) : undefined,
  };
}

export async function listStaffAttendanceRoster(tenantId: string, date: string) {
  const staffRows = await listStaffForTenant(tenantId);
  const active = staffRows.filter((s) => (s.status ?? "active") === "active");

  if (!(await tableExists("staff_attendance"))) {
    return {
      date,
      rows: active.map((s) => ({ staff: toStaffRow(s as Record<string, unknown>), attendance: null })),
      attendanceTableMissing: true,
    };
  }

  const attRows = await db
    .select()
    .from(staffAttendance)
    .where(and(eq(staffAttendance.tenantId, tenantId), eq(staffAttendance.date, date)));
  const attByStaff = new Map(attRows.filter((a) => a.staffId).map((a) => [a.staffId!, a]));

  const rows = active
    .map((s) => ({
      staff: toStaffRow(s as Record<string, unknown>),
      attendance: attByStaff.get(String(s.id)) ?? null,
    }))
    .sort((a, b) => a.staff.employeeNo.localeCompare(b.staff.employeeNo));

  return { date, rows, attendanceTableMissing: false };
}

export async function bulkSaveStaffAttendance(
  tenantId: string,
  date: string,
  records: { staffId: string; status: string; notes?: string }[],
) {
  if (!(await tableExists("staff_attendance"))) {
    throw new Error("Staff attendance table missing — run npm run db:repair on the server");
  }
  const saved = [];
  for (const rec of records) {
    const row = await getStaffById(tenantId, rec.staffId);
    if (!row) continue;
    const [existing] = await db
      .select()
      .from(staffAttendance)
      .where(
        and(
          eq(staffAttendance.tenantId, tenantId),
          eq(staffAttendance.staffId, rec.staffId),
          eq(staffAttendance.date, date),
        ),
      )
      .limit(1);
    let out;
    if (existing) {
      [out] = await db
        .update(staffAttendance)
        .set({
          status: rec.status,
          notes: rec.notes,
          checkedInAt: new Date(),
          userId: row.userId ?? existing.userId,
        })
        .where(eq(staffAttendance.id, existing.id))
        .returning();
    } else {
      [out] = await db
        .insert(staffAttendance)
        .values({
          tenantId,
          staffId: rec.staffId,
          userId: row.userId ?? undefined,
          date,
          status: rec.status,
          notes: rec.notes,
        })
        .returning();
    }
    if (out) saved.push(out);
  }
  return saved;
}

export async function staffAttendanceReport(tenantId: string, from: string, to: string) {
  if (!(await tableExists("staff_attendance"))) return { from, to, rows: [] };
  return db
    .select({
      staffId: staffAttendance.staffId,
      employeeNo: staff.employeeNo,
      firstName: staff.firstName,
      lastName: staff.lastName,
      present: sql<number>`count(*) filter (where ${staffAttendance.status} = 'present')`,
      absent: sql<number>`count(*) filter (where ${staffAttendance.status} = 'absent')`,
      late: sql<number>`count(*) filter (where ${staffAttendance.status} = 'late')`,
      onLeave: sql<number>`count(*) filter (where ${staffAttendance.status} = 'on_leave')`,
    })
    .from(staffAttendance)
    .innerJoin(staff, eq(staffAttendance.staffId, staff.id))
    .where(
      and(
        eq(staffAttendance.tenantId, tenantId),
        gte(staffAttendance.date, from),
        lte(staffAttendance.date, to),
      ),
    )
    .groupBy(staffAttendance.staffId, staff.employeeNo, staff.firstName, staff.lastName);
}
