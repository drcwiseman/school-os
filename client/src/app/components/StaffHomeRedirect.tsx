import { Navigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { isTeacherHomeUser, staffHomeSegment } from "../lib/staff-home";
import { Dashboard } from "../pages/Dashboard";

/** Default landing for unknown staff routes. */
export function StaffHomeRedirect() {
  const { schoolSlug, roles, permissions } = useAuth();
  if (!schoolSlug) return <Navigate to="/login" replace />;
  return <Navigate to={`/s/${schoolSlug}/${staffHomeSegment(roles, permissions)}`} replace />;
}

/** Admin KPI dashboard — redirects teachers to their workspace. */
export function DashboardGate() {
  const { schoolSlug, roles, permissions } = useAuth();
  if (schoolSlug && isTeacherHomeUser(roles, permissions)) {
    return <Navigate to={`/s/${schoolSlug}/teacher`} replace />;
  }
  return <Dashboard />;
}
