import { db } from "../db";
import { sql } from "drizzle-orm";

/** Tables cleared on operational reset (tenant shell, users, roles, settings preserved). */
const RESET_TABLES = [
  "parent_sessions", "student_sessions", "parent_accounts", "student_accounts",
  "gate_passes", "school_tickets", "staff_hostel_allocations", "staff_hostel_rooms", "staff_hostel_blocks",
  "facility_room_bookings", "facility_rooms", "library_loans", "library_fines", "library_cards",
  "library_copies", "library_books", "library_reservations", "library_ebooks",
  "route_assignments", "transport_alerts", "vehicle_maintenance_logs", "transport_fuel_logs",
  "vehicle_gps_pings", "transport_drivers", "transport_vehicles", "transport_stops", "transport_routes",
  "boarding_room_history", "hostel_disciplinary", "hostel_meals", "hostel_attendance", "hostel_visitors",
  "welfare_notes", "boarding_allocations", "boarding_rooms", "boarding_houses",
  "student_leave_requests", "student_transfers", "student_certificates", "student_documents",
  "assignment_submissions", "assignments", "lesson_logs", "student_materials", "online_class_attendance",
  "online_class_links", "timetable_periods", "timetables", "attendance_records", "attendance_sessions",
  "marks", "exam_admit_cards", "exam_timetable_slots", "exam_academic_group_members", "exam_academic_groups",
  "exam_groups", "report_cards", "assessments", "payments", "receipts", "invoice_items", "invoices",
  "fee_discounts", "student_fee_concessions", "recurring_fee_schedules", "donations", "expenses",
  "school_events", "announcements", "delivery_logs", "campaigns",
  "staff_attendance", "leave_requests", "payroll_runs", "payroll_items",
  "student_class_history", "student_guardians", "guardians", "students", "staff",
  "teacher_assignments", "subjects", "streams", "classes", "terms", "academic_years",
];

export async function resetTenantOperationalData(tenantId: string): Promise<{ tablesCleared: number }> {
  let tablesCleared = 0;
  for (const table of RESET_TABLES) {
    try {
      await db.execute(sql`DELETE FROM ${sql.raw(`"${table}"`)} WHERE tenant_id = ${tenantId}`);
      tablesCleared++;
    } catch {
      // table may not exist on older DBs
    }
  }
  return { tablesCleared };
}
