import { schoolPath } from "./tenant-host";

export type StaffRole = { id?: string; name: string };

/** Teacher-only staff (not admin, bursar, or headteacher). */
export function isTeacherHomeUser(roles: StaffRole[], permissions: string[]): boolean {
  const names = roles.map((r) => r.name.toLowerCase());
  const isAdminLike = names.some((n) =>
    /school administrator|tenant admin|administrator|deputy admin|bursar/.test(n),
  );
  const isHeadteacher = names.includes("headteacher");
  const isTeacher = names.includes("teacher");

  if (isTeacher && !isAdminLike && !isHeadteacher) return true;
  if (
    isTeacher
    && permissions.includes("academics.view")
    && !permissions.includes("settings.users.manage")
    && !permissions.includes("hr.view")
    && !permissions.includes("finance.view")
  ) {
    return true;
  }
  return false;
}

export function staffHomeSegment(roles: StaffRole[], permissions: string[]): "teacher" | "dashboard" {
  return isTeacherHomeUser(roles, permissions) ? "teacher" : "dashboard";
}

export function staffHomePath(schoolSlug: string, roles: StaffRole[], permissions: string[]): string {
  return schoolPath(schoolSlug, staffHomeSegment(roles, permissions));
}
