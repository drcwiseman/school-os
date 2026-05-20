import React, { useEffect, useMemo } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Building2, CreditCard, Globe,
  Tags, LayoutTemplate, Receipt, FileText, ArrowRightLeft,
  Landmark, Users, Shield, ScrollText, HardDrive,
  LifeBuoy, ListTodo, Settings, Flag, Mail,
  Blocks, DatabaseBackup, Loader2, Search, HelpCircle, Menu,
} from "lucide-react";
import { usePlatformAuth } from "./hooks/usePlatformAuth";
import { PlatformUserMenu } from "./components/PlatformUserMenu";
import { PlatformNotifications } from "./components/PlatformNotifications";

const PAGE_TITLES: Record<string, string> = {
  "/platform/dashboard": "Dashboard",
  "/platform/profile": "Profile",
  "/platform/tenants": "Schools",
  "/platform/subscriptions": "Subscriptions",
  "/platform/subscriptions/plans": "Plans & Pricing",
  "/platform/subscriptions/ledger": "Revenue",
  "/platform/invoices": "Invoices",
  "/platform/domains": "Domains",
  "/platform/marketplace": "Marketplace",
  "/platform/settings/general": "Marketing & SEO",
  "/platform/settings/marketing": "Marketing & SEO",
  "/platform/system/audit": "Audit Logs",
  "/platform/system/queue": "Job Queue",
  "/platform/support": "Support Tickets",
};

const navGroups = [
  {
    label: "TENANT MANAGEMENT",
    items: [
      { to: "/platform/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/platform/tenants", label: "Schools", icon: Building2 },
      { to: "/platform/subscriptions/plans", label: "Plans & Pricing", icon: Tags },
      { to: "/platform/subscriptions", label: "Subscriptions", icon: CreditCard, end: true },
      { to: "/platform/domains", label: "Domains", icon: Globe },
      { to: "/platform/marketplace", label: "Add-ons Marketplace", icon: LayoutTemplate },
    ],
  },
  {
    label: "FINANCE",
    items: [
      { to: "/platform/subscriptions/ledger", label: "Revenue", icon: Landmark },
      { to: "/platform/invoices", label: "Invoices", icon: FileText },
      { to: "/platform/transactions", label: "Transactions", icon: ArrowRightLeft },
      { to: "/platform/payouts", label: "Payouts", icon: Receipt },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { to: "/platform/users", label: "Users (Platform)", icon: Users },
      { to: "/platform/roles", label: "Roles & Permissions", icon: Shield },
      { to: "/platform/system/audit", label: "Audit Logs", icon: ScrollText },
      { to: "/platform/logs", label: "System Logs", icon: HardDrive },
      { to: "/platform/support", label: "Support Tickets", icon: LifeBuoy },
      { to: "/platform/system/queue", label: "Job Queue", icon: ListTodo },
    ],
  },
  {
    label: "SETTINGS",
    items: [
      { to: "/platform/settings/marketing", label: "Marketing & SEO", icon: Settings },
      { to: "/platform/settings/flags", label: "Feature Flags", icon: Flag },
      { to: "/platform/settings/email", label: "Email Templates", icon: Mail },
      { to: "/platform/settings/integrations", label: "Integrations", icon: Blocks },
      { to: "/platform/settings/backup", label: "Backup & Restore", icon: DatabaseBackup },
    ],
  },
];

export const PlatformLayout: React.FC = () => {
  const { ready, admin, logout } = usePlatformAuth();
  const location = useLocation();
  const pageTitle = useMemo(() => {
    if (location.pathname.startsWith("/platform/tenants/") && location.pathname !== "/platform/tenants") {
      return "School details";
    }
    return PAGE_TITLES[location.pathname] ?? "Platform";
  }, [location.pathname]);

  useEffect(() => {
    document.body.classList.add("platform-active");
    document.documentElement.classList.add("platform-active");
    return () => {
      document.body.classList.remove("platform-active");
      document.documentElement.classList.remove("platform-active");
    };
  }, []);

  if (!ready) {
    return (
      <div className="h-[100dvh] bg-[#f4f6f8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex overflow-hidden bg-[#f4f6f8] text-[#1e293b] font-sans antialiased">
      {/* Sidebar: logo fixed, nav scrolls on its own */}
      <aside className="hidden lg:flex w-[260px] shrink-0 flex-col h-full bg-[#0f172a] text-slate-300 shadow-xl border-r border-slate-800/80">
        <div className="shrink-0 px-5 py-5 border-b border-slate-800 bg-[#0f172a]">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">
              <Shield size={18} />
            </div>
            <div className="min-w-0">
              <p className="font-bold tracking-tight leading-tight text-lg truncate">SchoolOS</p>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mt-0.5">Platform Admin</p>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-4 platform-sidebar-scroll">
          {navGroups.map((group, i) => (
            <div key={i} className="mb-6 px-3">
              <p className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {group.label}
              </p>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                          isActive
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon size={16} className={`shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </aside>

      {/* Main: header fixed, page content scrolls */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden bg-[#f4f6f8]">
        <header className="shrink-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4 min-w-0">
            <button type="button" className="lg:hidden text-slate-500 hover:text-slate-700 shrink-0">
              <Menu size={20} />
            </button>
            <h1 className="text-xl font-bold text-slate-800 hidden sm:block truncate">{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            <div className="hidden md:flex relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" />
              <input
                type="text"
                placeholder="Search schools, users, invoices..."
                className="w-48 lg:w-80 max-w-[40vw] bg-slate-50 border border-slate-200 rounded-full pl-9 pr-12 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex gap-1">
                <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-500">⌘</kbd>
                <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-500">K</kbd>
              </div>
            </div>

            <PlatformNotifications />

            <Link
              to="/platform/support"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 hidden sm:block transition-colors"
              aria-label="Help and support"
            >
              <HelpCircle size={20} />
            </Link>

            <PlatformUserMenu admin={admin} onLogout={logout} />
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
