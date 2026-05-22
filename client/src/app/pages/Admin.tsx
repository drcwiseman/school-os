import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import {
  Shield, Users, ScrollText, Megaphone, GraduationCap, Calendar, Building2, Palette, Wand2, LayoutDashboard, Database, ExternalLink,
} from "lucide-react";
import { AdminAccessPanel } from "../components/admin/AdminAccessPanel";
import {
  AdminOverviewPanel,
  NoticeboardAdminPanel,
  ClassesSectionsPanel,
  SessionsPanel,
  MultiSchoolPanel,
  AppearancePanel,
  SetupWizardPanel,
  PortalDashboardsPanel,
  SystemUtilitiesPanel,
  AuditPanel,
} from "../components/admin/AdminEnhancementPanels";

type Tab =
  | "overview" | "access" | "portal" | "noticeboard" | "classes" | "sessions"
  | "branches" | "appearance" | "wizard" | "utilities" | "audit";

export const Admin: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  const tabs: { id: Tab; label: string; icon: React.ElementType; show?: boolean }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard, show: hasPermission("settings.view") },
    { id: "wizard", label: "Setup", icon: Wand2, show: hasPermission("settings.manage") },
    { id: "utilities", label: "Demo data", icon: Database, show: hasPermission("settings.manage") || hasPermission("settings.view") },
    { id: "access", label: "Users & roles", icon: Shield, show: hasPermission("settings.users.view") || hasPermission("rbac.manage.roles") },
    { id: "noticeboard", label: "Noticeboard", icon: Megaphone, show: hasPermission("messaging.view") },
    { id: "classes", label: "Classes", icon: GraduationCap, show: hasPermission("academics.view") },
    { id: "sessions", label: "Sessions", icon: Calendar, show: hasPermission("academics.view") },
    { id: "branches", label: "Branches", icon: Building2, show: hasPermission("settings.view") },
    { id: "appearance", label: "Appearance", icon: Palette, show: hasPermission("settings.manage") },
    { id: "portal", label: "Portal", icon: Users, show: true },
    { id: "audit", label: "Audit log", icon: ScrollText, show: hasPermission("audit.view") },
  ];

  const visibleTabs = tabs.filter((t) => t.show !== false);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex-col sm:flex-row gap-4">
        <div>
          <h1 className="page-title">Administration</h1>
          <p className="text-slate-400 mt-1">School setup, staff access, academics structure, and system tools</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/s/${schoolSlug}/settings`} className="btn-secondary text-sm">School settings</Link>
          <a href={`/s/${schoolSlug}/portal/login`} target="_blank" rel="noreferrer" className="btn-ghost text-sm">
            <ExternalLink className="w-4 h-4" /> Portal
          </a>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pb-1">
        {visibleTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
              tab === id ? "bg-primary-600 text-white shadow-lg shadow-primary-900/30" : "bg-slate-800/80 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && schoolSlug && (
        <AdminOverviewPanel schoolSlug={schoolSlug} onNavigate={(t) => setTab(t as Tab)} />
      )}
      {tab === "wizard" && schoolSlug && <SetupWizardPanel schoolSlug={schoolSlug} />}
      {tab === "utilities" && schoolSlug && <SystemUtilitiesPanel schoolSlug={schoolSlug} />}
      {tab === "portal" && schoolSlug && <PortalDashboardsPanel schoolSlug={schoolSlug} />}
      {tab === "noticeboard" && schoolSlug && <NoticeboardAdminPanel schoolSlug={schoolSlug} />}
      {tab === "classes" && schoolSlug && <ClassesSectionsPanel schoolSlug={schoolSlug} />}
      {tab === "sessions" && schoolSlug && <SessionsPanel schoolSlug={schoolSlug} />}
      {tab === "branches" && schoolSlug && <MultiSchoolPanel schoolSlug={schoolSlug} />}
      {tab === "appearance" && schoolSlug && <AppearancePanel schoolSlug={schoolSlug} />}
      {tab === "access" && schoolSlug && (
        <AdminAccessPanel
          schoolSlug={schoolSlug}
          canManageRoles={hasPermission("rbac.manage.roles")}
          canManageUsers={hasPermission("settings.users.manage")}
          canManagePerms={hasPermission("rbac.manage.permissions")}
        />
      )}
      {tab === "audit" && schoolSlug && <AuditPanel schoolSlug={schoolSlug} />}
    </div>
  );
};
