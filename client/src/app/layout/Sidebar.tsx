import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import {
  LayoutDashboard, Users, UserCog,   LogOut, Settings, GraduationCap, DollarSign,
  CalendarCheck, BookOpen, ClipboardList, Briefcase, Wallet, Bus, Megaphone, FileBarChart,
  ShieldAlert, HeartPulse, Library, Package, Home, ExternalLink,
} from "lucide-react";
import { OPERATIONS_MODULES } from "../pages/operations-modules";
import { MODULE_FEATURE_CODES } from "../../lib/module-features";

const OPS_ICONS: Record<string, React.ElementType> = {
  discipline: ShieldAlert,
  health: HeartPulse,
  library: Library,
  inventory: Package,
  transport: Bus,
  boarding: Home,
};

export const Sidebar: React.FC = () => {
  const { schoolSlug, logout, user, hasPermission, moduleEnabled } = useAuth();
  const location = useLocation();

  type NavLink = {
    name: string;
    path: string;
    icon: React.ElementType;
    perm?: string;
    feature?: string;
    external?: boolean;
  };

  const allLinks: NavLink[] = [
    { name: "Dashboard", path: `/s/${schoolSlug}/dashboard`, icon: LayoutDashboard },
    { name: "Admissions", path: `/s/${schoolSlug}/admissions`, icon: UserCog, perm: "admissions.view", feature: MODULE_FEATURE_CODES.admissions },
    { name: "Students", path: `/s/${schoolSlug}/students`, icon: GraduationCap, perm: "students.view", feature: MODULE_FEATURE_CODES.students },
    { name: "Attendance", path: `/s/${schoolSlug}/attendance`, icon: CalendarCheck, perm: "attendance.view", feature: MODULE_FEATURE_CODES.attendance },
    { name: "Academics", path: `/s/${schoolSlug}/academics`, icon: BookOpen, perm: "academics.view", feature: MODULE_FEATURE_CODES.academics },
    { name: "Exams", path: `/s/${schoolSlug}/exams`, icon: ClipboardList, perm: "exams.view", feature: MODULE_FEATURE_CODES.exams },
    { name: "Finance", path: `/s/${schoolSlug}/finance`, icon: DollarSign, perm: "finance.view", feature: MODULE_FEATURE_CODES.finance },
    { name: "HR", path: `/s/${schoolSlug}/hr`, icon: Briefcase, perm: "hr.view", feature: MODULE_FEATURE_CODES.hr },
    { name: "Payroll", path: `/s/${schoolSlug}/payroll`, icon: Wallet, perm: "payroll.view", feature: MODULE_FEATURE_CODES.payroll },
    ...OPERATIONS_MODULES.map((m) => ({
      name: m.label,
      path: `/s/${schoolSlug}/ops/${m.id}`,
      icon: OPS_ICONS[m.id] ?? Bus,
      perm: m.perm,
      feature: MODULE_FEATURE_CODES[m.id],
    })),
    { name: "Messaging", path: `/s/${schoolSlug}/messaging`, icon: Megaphone, perm: "messaging.view", feature: MODULE_FEATURE_CODES.messaging },
    { name: "Parent portal", path: `/s/${schoolSlug}/portal/login`, icon: ExternalLink, feature: MODULE_FEATURE_CODES.portal, external: true },
    { name: "Reports", path: `/s/${schoolSlug}/reports`, icon: FileBarChart, perm: "reports.view", feature: MODULE_FEATURE_CODES.reports },
    { name: "Users & Roles", path: `/s/${schoolSlug}/admin`, icon: Users, perm: "rbac.manage.roles" },
    { name: "Settings", path: `/s/${schoolSlug}/settings`, icon: Settings, perm: "settings.view" },
  ];
  const links = allLinks.filter((l) => {
    if (l.perm && !hasPermission(l.perm)) return false;
    if (l.feature && !moduleEnabled(l.feature)) return false;
    return true;
  });

  return (
    <aside className="w-64 border-r border-slate-800 bg-surface flex flex-col h-screen">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight">School OS</h1>
        <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{schoolSlug}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map((item) => {
          const active = location.pathname.startsWith(item.path);
          const Icon = item.icon;
          const external = item.external;
          return (
            <Link
              key={item.name}
              to={item.path}
              target={external ? "_blank" : undefined}
              rel={external ? "noopener noreferrer" : undefined}
              className={`nav-item ${active ? "active" : ""}`}
            >
              <Icon className="w-5 h-5" />
              {item.name}
            </Link>
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
