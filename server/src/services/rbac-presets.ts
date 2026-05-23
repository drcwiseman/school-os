/** Preset permission codes for common school roles (portal users are separate). */
export const RBAC_PRESETS: Record<string, { label: string; description: string; codes: string[] }> = {
  administrator: {
    label: "School Administrator",
    description: "Full access to all school modules",
    codes: ["*"],
  },
  teacher: {
    label: "Teacher",
    description: "Classes, attendance, marks, and student view",
    codes: [
      "students.view", "attendance.view", "attendance.take", "attendance.edit",
      "academics.view", "academics.teach",
      "exams.view", "exams.enter_marks", "messaging.view", "messaging.send",
      "reports.view",
    ],
  },
  bursar: {
    label: "Bursar / Finance",
    description: "Fees, invoices, payments, and finance reports",
    codes: [
      "finance.view", "finance.invoice.create", "finance.payment.create", "finance.refund.create",
      "students.view", "reports.view", "reports.export",
    ],
  },
  secretary: {
    label: "Secretary",
    description: "Admissions, messaging, and student records",
    codes: [
      "admissions.view", "admissions.create", "admissions.edit", "admissions.enroll",
      "students.view", "students.create", "students.edit", "messaging.view", "messaging.send",
      "gate_pass.view", "gate_pass.manage",
    ],
  },
  parent_portal: {
    label: "Parent (portal only)",
    description: "Parents sign in at the portal — not staff RBAC. Create parent accounts under Parents.",
    codes: [],
  },
};
