import { Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "./layout/DashboardLayout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { StudentsList } from "./pages/StudentsList";
import { Admissions } from "./pages/Admissions";
import { Attendance } from "./pages/Attendance";
import { Admin } from "./pages/Admin";
import { Finance } from "./pages/Finance";
import { Academics } from "./pages/Academics";
import { Exams } from "./pages/Exams";
import { HR } from "./pages/HR";
import { Payroll } from "./pages/Payroll";
import { Operations } from "./pages/Operations";
import { Messaging } from "./pages/Messaging";
import { Reports } from "./pages/Reports";
import { PortalLogin } from "./pages/PortalLogin";
import { PortalDashboard } from "./pages/PortalDashboard";
import { PlatformLogin } from "./pages/PlatformLogin";
import { PlatformConsole } from "./pages/PlatformConsole";
import { Settings } from "./pages/Settings";
import { Home } from "./pages/Home";

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />

      <Route path="/s/:schoolSlug/login" element={<Login />} />
      <Route path="/s/:schoolSlug/portal/login" element={<PortalLogin />} />
      <Route path="/s/:schoolSlug/portal/dashboard" element={<PortalDashboard />} />

      <Route path="/platform/login" element={<PlatformLogin />} />
      <Route path="/platform/tenants" element={<PlatformConsole />} />
      <Route path="/platform" element={<Navigate to="/platform/login" replace />} />

      <Route path="/s/:schoolSlug/*" element={<DashboardLayout />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="students" element={<StudentsList />} />
        <Route path="admissions" element={<Admissions />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="academics" element={<Academics />} />
        <Route path="exams" element={<Exams />} />
        <Route path="finance" element={<Finance />} />
        <Route path="hr" element={<HR />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="operations" element={<Operations />} />
        <Route path="messaging" element={<Messaging />} />
        <Route path="reports" element={<Reports />} />
        <Route path="admin" element={<Admin />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
};
