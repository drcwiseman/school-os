import { Routes, Route, Navigate } from "react-router-dom";
import { CustomDomainShell } from "./components/CustomDomainShell";
import { schoolDashboardRouteElements } from "./routes/school-dashboard-routes";
import { DashboardLayout } from "./layout/DashboardLayout";
import { PublicLayout } from "./public/layout/PublicLayout";
import { MarketingHome } from "./public/Home";
import { Features } from "./public/Features";
import { Pricing } from "./public/Pricing";
import { About } from "./public/About";
import { Contact } from "./public/Contact";
import { IntegrationsPage } from "./public/Integrations";
import { PlatformMarketing } from "./platform/PlatformMarketing";
import { PlatformGeneralSettings } from "./platform/PlatformGeneralSettings";
import { Login } from "./pages/Login";
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
import { InvoicesHub } from "./platform/Finance/InvoicesHub";
import { TransactionsHub } from "./platform/Finance/TransactionsHub";
import { PayoutsHub } from "./platform/Finance/PayoutsHub";
import { PlatformUsersHub } from "./platform/Users/PlatformUsersHub";
import { RolesHub } from "./platform/Users/RolesHub";
import { AddonMarketplace } from "./platform/Marketplace";
import { SupportHub } from "./platform/Support/SupportHub";
import { QueueMonitor } from "./platform/System/QueueMonitor";
import { AuditLogs } from "./platform/System/AuditLogs";
import { SystemLogsHub } from "./platform/System/SystemLogsHub";
import { PlatformMediaLibrary } from "./platform/Media/PlatformMediaLibrary";
import { PlatformEmailSettings } from "./platform/PlatformEmailSettings";
import { PlatformIntegrationsSettings } from "./platform/PlatformIntegrationsSettings";
import { PlatformBackupSettings } from "./platform/PlatformBackupSettings";
import { PlatformFeatureFlags } from "./platform/PlatformFeatureFlags";
import { PlatformApiSettings } from "./platform/PlatformApiSettings";
import { PublicApply } from "./pages/PublicApply";
import { StudentCbtExam } from "./pages/StudentCbtExam";
export const AppRoutes = () => {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<MarketingHome />} />
        <Route path="/features" element={<Features />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
      </Route>

      <Route path="/s/:schoolSlug/login" element={<Login />} />
      <Route path="/s/:schoolSlug/impersonate" element={<ImpersonateExchange />} />
      <Route path="/s/:schoolSlug/apply" element={<PublicApply />} />
      <Route path="/s/:schoolSlug/portal/login" element={<PortalLogin />} />
      <Route path="/s/:schoolSlug/portal/dashboard" element={<PortalDashboard />} />
      <Route path="/s/:schoolSlug/exam" element={<StudentCbtExam />} />

      <Route element={<CustomDomainShell />}>
        <Route path="/login" element={<Login />} />
        <Route path="/impersonate" element={<ImpersonateExchange />} />
        <Route path="/apply" element={<PublicApply />} />
        <Route path="/portal/login" element={<PortalLogin />} />
        <Route path="/portal/dashboard" element={<PortalDashboard />} />
        <Route path="/exam" element={<StudentCbtExam />} />
        <Route element={<DashboardLayout />}>
          {schoolDashboardRouteElements()}
        </Route>
      </Route>

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
        <Route path="invoices" element={<InvoicesHub />} />
        <Route path="transactions" element={<TransactionsHub />} />
        <Route path="payouts" element={<PayoutsHub />} />
        <Route path="users" element={<PlatformUsersHub />} />
        <Route path="roles" element={<RolesHub />} />
        <Route path="logs" element={<SystemLogsHub />} />
        <Route path="support" element={<SupportHub />} />
        <Route path="system/queue" element={<QueueMonitor />} />
        <Route path="system/audit" element={<AuditLogs />} />
        <Route path="media" element={<PlatformMediaLibrary />} />
        <Route path="settings/general" element={<PlatformGeneralSettings />} />
        <Route path="settings/marketing" element={<PlatformMarketing />} />
        <Route path="settings/flags" element={<PlatformFeatureFlags />} />
        <Route path="settings/api" element={<PlatformApiSettings />} />
        <Route path="settings/email" element={<PlatformEmailSettings />} />
        <Route path="settings/integrations" element={<PlatformIntegrationsSettings />} />
        <Route path="settings/backup" element={<PlatformBackupSettings />} />
        <Route index element={<Navigate to="dashboard" replace />} />
      </Route>

      <Route path="/s/:schoolSlug/*" element={<DashboardLayout />}>
        {schoolDashboardRouteElements()}
      </Route>
    </Routes>
  );
};
