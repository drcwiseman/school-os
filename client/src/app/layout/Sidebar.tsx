import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import {
  LayoutDashboard, Users, UserCog, LogOut, Settings, GraduationCap, DollarSign, BookMarked, Building2, Shield, Sparkles,
  CalendarCheck, BookOpen, ClipboardList, Briefcase, Wallet, Bus, Megaphone, FileBarChart, School, Warehouse,
  ShieldAlert, HeartPulse, Library, Package, Home, ExternalLink, HelpCircle, ChevronUp, ChevronDown,
} from "lucide-react";
import { OPS_SIDEBAR_MODULES } from "../pages/operations-modules";
import { MODULE_FEATURE_CODES } from "../../lib/module-features";
import {
  canAccessFacilities,
  facilitiesPath,
  isFacilitiesNavActive,
  type FacilitiesTabId,
} from "../../lib/facilities-nav";
import { schoolPath } from "../lib/tenant-host";

const OPS_ICONS: Record<string, React.ElementType> = {
  discipline: ShieldAlert,
  health: HeartPulse,
  library: Library,
  inventory: Package,
  transport: Bus,
  boarding: Home,
};

const FACILITIES_QUICK: { tab: FacilitiesTabId; name: string; perm: string; feature?: string; icon: React.ElementType }[] = [
  { tab: "library", name: "Library", perm: "library.view", feature: MODULE_FEATURE_CODES.library, icon: Library },
  { tab: "transport", name: "Transport", perm: "transport.view", feature: MODULE_FEATURE_CODES.transport, icon: Bus },
  { tab: "hostel", name: "Hostel", perm: "boarding.view", feature: MODULE_FEATURE_CODES.boarding, icon: Home },
];

export const Sidebar: React.FC<{ mobileOpen?: boolean; onMobileClose?: () => void }> = ({
  mobileOpen = false,
  onMobileClose,
}) => {
  const { schoolSlug, logout, user, hasPermission, moduleEnabled } = useAuth();
  const location = useLocation();

  type NavLink = {
    name: string;
    path: string;
    icon: React.ElementType;
    perm?: string;
    feature?: string;
    external?: boolean;
    facilitiesTab?: FacilitiesTabId;
  };

  const p = (sub: string) => (schoolSlug ? schoolPath(schoolSlug, sub) : "/");
  const allLinks: NavLink[] = [
    { name: "Dashboard", path: p("dashboard"), icon: LayoutDashboard },
    { name: "Admissions", path: p("admissions"), icon: UserCog, perm: "admissions.view", feature: MODULE_FEATURE_CODES.admissions },
    { name: "Students", path: p("students"), icon: GraduationCap, perm: "students.view", feature: MODULE_FEATURE_CODES.students },
    { name: "Parents", path: p("parents"), icon: Users, perm: "students.view", feature: MODULE_FEATURE_CODES.students },
    { name: "Teachers", path: p("teachers"), icon: School, perm: "hr.view", feature: MODULE_FEATURE_CODES.hr },
    { name: "Attendance", path: p("attendance"), icon: CalendarCheck, perm: "attendance.view", feature: MODULE_FEATURE_CODES.attendance },
    { name: "Academics", path: p("academics"), icon: BookOpen, perm: "academics.view", feature: MODULE_FEATURE_CODES.academics },
    { name: "Curriculum", path: p("curriculum"), icon: BookMarked, perm: "academics.view", feature: MODULE_FEATURE_CODES.academics },
    { name: "Teacher workspace", path: p("teacher"), icon: School, perm: "academics.view" },
    { name: "Exams", path: p("exams"), icon: ClipboardList, perm: "exams.view", feature: MODULE_FEATURE_CODES.exams },
    { name: "Finance", path: p("finance"), icon: DollarSign, perm: "finance.view", feature: MODULE_FEATURE_CODES.finance },
    { name: "HR", path: p("hr"), icon: Briefcase, perm: "hr.view", feature: MODULE_FEATURE_CODES.hr },
    { name: "Payroll", path: p("payroll"), icon: Wallet, perm: "payroll.view", feature: MODULE_FEATURE_CODES.payroll },
    ...(canAccessFacilities(hasPermission, moduleEnabled)
      ? [
          { name: "Facilities", path: facilitiesPath(schoolSlug!), icon: Warehouse, facilitiesTab: "overview" as FacilitiesTabId },
          ...FACILITIES_QUICK.filter((q) => hasPermission(q.perm) && (!q.feature || moduleEnabled(q.feature))).map((q) => ({
            name: q.name,
            path: facilitiesPath(schoolSlug!, q.tab),
            icon: q.icon,
            perm: q.perm,
            feature: q.feature,
            facilitiesTab: q.tab,
          })),
        ]
      : []),
    ...OPS_SIDEBAR_MODULES.map((m) => ({
      name: m.label,
      path: p(`ops/${m.id}`),
      icon: OPS_ICONS[m.id] ?? Bus,
      perm: m.perm,
      feature: MODULE_FEATURE_CODES[m.id],
    })),
    { name: "Messaging", path: p("messaging"), icon: Megaphone, perm: "messaging.view", feature: MODULE_FEATURE_CODES.messaging },
    { name: "Parent portal", path: p("portal/login"), icon: ExternalLink, feature: MODULE_FEATURE_CODES.portal, external: true },
    { name: "Reports", path: p("reports"), icon: FileBarChart, perm: "reports.view", feature: MODULE_FEATURE_CODES.reports },
    { name: "AI Admin", path: p("ai-admin"), icon: Sparkles, perm: "settings.view", feature: "ai_homework" },
    { name: "Administration", path: p("admin"), icon: Shield, perm: "settings.view" },
    { name: "Campuses", path: p("campuses"), icon: Building2, feature: "multi_campus" },
    { name: "Security", path: p("security"), icon: Shield, perm: "settings.view" },
    { name: "Help", path: p("help"), icon: HelpCircle },
    { name: "Settings", path: p("settings"), icon: Settings, perm: "settings.view" },
  ];

  const filtered = allLinks.filter((l) => {
    if (l.perm && !hasPermission(l.perm)) return false;
    if (l.feature && !moduleEnabled(l.feature)) return false;
    return true;
  });

  const orderKey = `schoolos_sidebar_${schoolSlug}`;
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(orderKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const links = useMemo(() => {
    if (!order.length) return filtered;
    const byPath = new Map(filtered.map((l) => [l.path, l]));
    const sorted = order.map((p) => byPath.get(p)).filter(Boolean) as typeof filtered;
    for (const l of filtered) if (!sorted.includes(l)) sorted.push(l);
    return sorted;
  }, [filtered, order]);

  const move = (path: string, dir: -1 | 1) => {
    const paths = links.map((l) => l.path);
    const i = paths.indexOf(path);
    const j = i + dir;
    if (j < 0 || j >= paths.length) return;
    [paths[i], paths[j]] = [paths[j], paths[i]];
    setOrder(paths);
    localStorage.setItem(orderKey, JSON.stringify(paths));
  };

  const linkActive = (item: NavLink) => {
    if (!schoolSlug) return false;
    if (item.facilitiesTab != null) {
      return isFacilitiesNavActive(location.pathname, location.search, schoolSlug, item.facilitiesTab);
    }
    const pathOnly = item.path.split("?")[0];
    return location.pathname.startsWith(pathOnly);
  };

  return (
    <aside
      className={`
        w-64 max-w-[85vw] border-r border-slate-800 bg-surface flex flex-col h-full shrink-0 z-50
        fixed inset-y-0 left-0 transition-transform duration-200 ease-out
        lg:static lg:translate-x-0 lg:max-w-none
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
    >
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight">School OS</h1>
        <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{schoolSlug}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map((item) => {
          const active = linkActive(item);
          const Icon = item.icon;
          const external = item.external;
          return (
            <div key={item.path} className="flex items-center gap-0.5 group">
              <Link
                to={item.path}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                onClick={onMobileClose}
                className={`nav-item flex-1 ${active ? "active" : ""} ${item.facilitiesTab && item.facilitiesTab !== "overview" ? "pl-8 text-[13px]" : ""}`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
              <div className="flex flex-col opacity-0 group-hover:opacity-100">
                <button type="button" className="p-0.5 text-slate-600 hover:text-slate-300" onClick={() => move(item.path, -1)} aria-label="Move up"><ChevronUp className="w-3 h-3" /></button>
                <button type="button" className="p-0.5 text-slate-600 hover:text-slate-300" onClick={() => move(item.path, 1)} aria-label="Move down"><ChevronDown className="w-3 h-3" /></button>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="mb-4 px-2">
          <p className="text-sm font-medium text-slate-300">{user?.firstName} {user?.lastName}</p>
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
        </div>
        <button onClick={logout} className="btn-ghost w-full justify-start text-red-400 hover:text-red-300 hover:border-red-900">
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
};
