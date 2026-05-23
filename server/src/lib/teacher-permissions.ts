/** Permissions for the seeded Teacher role (day-to-day teaching, not admin structure). */
export const TEACHER_ROLE_PERMISSION_CODES = [
  "attendance.view",
  "attendance.take",
  "attendance.edit",
  "academics.view",
  "academics.teach",
  "exams.view",
  "exams.enter_marks",
  "students.view",
  "messaging.view",
  "messaging.send",
  "reports.view",
] as const;

/** Teacher-owned writes — admins with academics.manage also pass. */
export const TEACHER_WRITE_PERMISSIONS = ["academics.teach", "academics.manage"] as const;
