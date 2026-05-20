import { Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "./layout/DashboardLayout";
import { PublicLayout } from "./public/layout/PublicLayout";
import { MarketingHome } from "./public/Home";
import { Features } from "./public/Features";
import { Pricing } from "./public/Pricing";
import { About } from "./public/About";
import { Contact } from "./public/Contact";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { StudentsList } from "./pages/StudentsList";
import { StudentDetail } from "./pages/StudentDetail";
import { Admissions } from "./pages/Admissions";
import { Attendance } from "./pages/Attendance";
import { Admin } from "./pages/Admin";
import { Finance } from "./pages/Finance";
import { Academics } from "./pages/Academics";
import { Exams } from "./pages/Exams";
import { HR } from "./pages/HR";
import { Payroll } from "./pages/Payroll";
import { OperationModulePage } from "./pages/OperationModulePage";
import { Messaging } from "./pages/Messaging";
import { Reports } from "./pages/Reports";
import { PortalLogin } from "./pages/PortalLogin";
import { PortalDashboard } from "./pages/PortalDashboard";
import { PlatformLogin } from "./pages/PlatformLogin";
import { PlatformLayout } from "./platform/PlatformLayout";
import { PlatformDashboard } from "./platform/Dashboard";
import { PlatformProfile } from "./platform/PlatformProfile";
import { TenantHub } from "./platform/Tenants/TenantHub";
import { TenantDetail } from "./platform/Tenants/TenantDetail";
import { DomainsHub } from "./platform/Tenants/Domains";
import { ImpersonateExchange } from "./pages/ImpersonateExchange";
import { PlanManager } from "./platform/Subscriptions/PlanManager";
import { SubscriptionHub } from "./platform/Subscriptions/SubscriptionHub";
import { RevenueLedger } from "./platform/Subscriptions/Ledger";
import { AddonMarketplace } from "./platform/Marketplace";
import { SupportHub } from "./platform/Support/SupportHub";
import { QueueMonitor } from "./platform/System/QueueMonitor";
import { AuditLogs } from "./platform/System/AuditLogs";
import { PlatformPlaceholder } from "./platform/PlatformPlaceholder";
import { Settings } from "./pages/Settings";

const stub = (title: string, hint?: string) => (
  <PlatformPlaceholder title={title} hint={hint} />
);

export const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<MarketingHome />} />
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Route>

      <Route path="/s/:schoolSlug/login" element={<Login />} />
      <Route path="/s/:schoolSlug/impersonate" element={<ImpersonateExchange />} />
      <Route path="/s/:schoolSlug/portal/login" element={<PortalLogin />} />
      <Route path="/s/:schoolSlug/portal/dashboard" element={<PortalDashboard />} />

      <Route path="/platform/login" element={<PlatformLogin />} />
      <Route path="/platform" element={<PlatformLayout />}>
        <Route path="dashboard" element={<PlatformDashboard />} />
        <Route path="profile" element={<PlatformProfile />} />
        <Route path="tenants" element={<TenantHub />} />
        <Route path="tenants/:slug" element={<TenantDetail />} />
        <Route path="subscriptions" element={<SubscriptionHub />} />
        <Route path="subscriptions/plans" element={<PlanManager />} />
        <Route path="subscriptions/ledger" element={<RevenueLedger />} />
        <Route path="domains" element={<DomainsHub />} />
        <Route path="custom-domains" element={<Navigate to="/platform/domains" replace />} />
        <Route path="marketplace" element={<AddonMarketplace />} />
        <Route path="invoices" element={stub("Invoices")} />
        <Route path="transactions" element={stub("Transactions")} />
        <Route path="payouts" element={stub("Payouts")} />
        <Route path="users" element={stub("Platform users")} />
        <Route path="roles" element={stub("Roles & permissions")} />
        <Route path="logs" element={stub("System logs")} />
        <Route path="support" element={<SupportHub />} />
        <Route path="system/queue" element={<QueueMonitor />} />
        <Route path="system/audit" element={<AuditLogs />} />
        <Route path="settings/general" element={stub("General settings", "Platform display currency is under Plans & Revenue for now.")} />
        <Route path="settings/flags" element={<Navigate to="/platform/tenants" replace />} />
        <Route path="settings/email" element={stub("Email templates")} />
        <Route path="settings/integrations" element={stub("Integrations")} />
        <Route path="settings/backup" element={stub("Backup & restore")} />
        <Route index element={<Navigate to="dashboard" replace />} />
      </Route>

      <Route path="/s/:schoolSlug/*" element={<DashboardLayout />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="students" element={<StudentsList />} />
        <Route path="students/:studentId" element={<StudentDetail />} />
        <Route path="admissions" element={<Admissions />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="academics" element={<Academics />} />
        <Route path="exams" element={<Exams />} />
        <Route path="finance" element={<Finance />} />
        <Route path="hr" element={<HR />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="ops/discipline" element={<OperationModulePage moduleId="discipline" />} />
        <Route path="ops/health" element={<OperationModulePage moduleId="health" />} />
        <Route path="ops/library" element={<OperationModulePage moduleId="library" />} />
        <Route path="ops/inventory" element={<OperationModulePage moduleId="inventory" />} />
        <Route path="ops/transport" element={<OperationModulePage moduleId="transport" />} />
        <Route path="ops/boarding" element={<OperationModulePage moduleId="boarding" />} />
        <Route path="operations" element={<Navigate to="ops/discipline" replace />} />
        <Route path="messaging" element={<Messaging />} />
        <Route path="reports" element={<Reports />} />
        <Route path="admin" element={<Admin />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>
    </Routes>
  );
};
