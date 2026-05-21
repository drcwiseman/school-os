import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import {
  LayoutDashboard, Users, UserCog, LogOut, Settings, GraduationCap, DollarSign, BookMarked, Building2, Shield, Sparkles,
  CalendarCheck, BookOpen, ClipboardList, Briefcase, Wallet, Bus, Megaphone, FileBarChart, School, Warehouse,
  ShieldAlert, HeartPulse, Library, Package, Home, ExternalLink, HelpCircle, ChevronUp, ChevronDown,
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
    { name: "Parents", path: `/s/${schoolSlug}/parents`, icon: Users, perm: "students.view", feature: MODULE_FEATURE_CODES.students },
    { name: "Teachers", path: `/s/${schoolSlug}/teachers`, icon: School, perm: "hr.view", feature: MODULE_FEATURE_CODES.hr },
    { name: "Attendance", path: `/s/${schoolSlug}/attendance`, icon: CalendarCheck, perm: "attendance.view", feature: MODULE_FEATURE_CODES.attendance },
    { name: "Academics", path: `/s/${schoolSlug}/academics`, icon: BookOpen, perm: "academics.view", feature: MODULE_FEATURE_CODES.academics },
    { name: "Curriculum", path: `/s/${schoolSlug}/curriculum`, icon: BookMarked, perm: "academics.view", feature: MODULE_FEATURE_CODES.academics },
    { name: "Teacher workspace", path: `/s/${schoolSlug}/teacher`, icon: School, perm: "academics.view" },
    { name: "Exams", path: `/s/${schoolSlug}/exams`, icon: ClipboardList, perm: "exams.view", feature: MODULE_FEATURE_CODES.exams },
    { name: "Finance", path: `/s/${schoolSlug}/finance`, icon: DollarSign, perm: "finance.view", feature: MODULE_FEATURE_CODES.finance },
    { name: "HR", path: `/s/${schoolSlug}/hr`, icon: Briefcase, perm: "hr.view", feature: MODULE_FEATURE_CODES.hr },
    { name: "Payroll", path: `/s/${schoolSlug}/payroll`, icon: Wallet, perm: "payroll.view", feature: MODULE_FEATURE_CODES.payroll },
    { name: "Facilities", path: `/s/${schoolSlug}/facilities`, icon: Warehouse },
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
    { name: "AI Admin", path: `/s/${schoolSlug}/ai-admin`, icon: Sparkles, perm: "settings.view", feature: "ai_homework" },
    { name: "Administration", path: `/s/${schoolSlug}/admin`, icon: Shield, perm: "settings.view" },
    { name: "Campuses", path: `/s/${schoolSlug}/campuses`, icon: Building2, feature: "multi_campus" },
    { name: "Security", path: `/s/${schoolSlug}/security`, icon: Shield, perm: "settings.view" },
    { name: "Help", path: `/s/${schoolSlug}/help`, icon: HelpCircle },
    { name: "Settings", path: `/s/${schoolSlug}/settings`, icon: Settings, perm: "settings.view" },
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
            <div key={item.path} className="flex items-center gap-0.5 group">
              <Link
                to={item.path}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className={`nav-item flex-1 ${active ? "active" : ""}`}
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
