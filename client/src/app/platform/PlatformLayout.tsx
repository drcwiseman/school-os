import React, { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard, Building2, CreditCard, Globe, Link as LinkIcon, 
  Tags, LayoutTemplate, Receipt, FileText, ArrowRightLeft, 
  Landmark, Users, Shield, ScrollText, HardDrive, 
  LifeBuoy, ListTodo, Settings, Flag, Mail, 
  Blocks, DatabaseBackup, Loader2, Search, Bell, HelpCircle, Menu
} from "lucide-react";
import { usePlatformAuth } from "./hooks/usePlatformAuth";

const navGroups = [
  {
    label: "TENANT MANAGEMENT",
    items: [
      { to: "/platform/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/platform/tenants", label: "Schools", icon: Building2 },
      { to: "/platform/subscriptions", label: "Subscriptions", icon: CreditCard },
      { to: "/platform/domains", label: "Domains", icon: Globe },
      { to: "/platform/custom-domains", label: "Custom Domains", icon: LinkIcon },
      { to: "/platform/subscriptions/plans", label: "Plans & Pricing", icon: Tags },
      { to: "/platform/marketplace", label: "Add-ons Marketplace", icon: LayoutTemplate },
    ]
  },
  {
    label: "FINANCE",
    items: [
      { to: "/platform/subscriptions/ledger", label: "Revenue", icon: Landmark },
      { to: "/platform/invoices", label: "Invoices", icon: FileText },
      { to: "/platform/transactions", label: "Transactions", icon: ArrowRightLeft },
      { to: "/platform/payouts", label: "Payouts", icon: Receipt },
    ]
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
    ]
  },
  {
    label: "SETTINGS",
    items: [
      { to: "/platform/settings/general", label: "General Settings", icon: Settings },
      { to: "/platform/settings/flags", label: "Feature Flags", icon: Flag },
      { to: "/platform/settings/email", label: "Email Templates", icon: Mail },
      { to: "/platform/settings/integrations", label: "Integrations", icon: Blocks },
      { to: "/platform/settings/backup", label: "Backup & Restore", icon: DatabaseBackup },
    ]
  }
];

export const PlatformLayout: React.FC = () => {
  const { ready, logout } = usePlatformAuth();

  useEffect(() => {
    document.body.classList.add("platform-active");
    return () => document.body.classList.remove("platform-active");
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#f4f6f8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f6f8] text-[#1e293b] font-sans antialiased flex">
      {/* Left Sidebar */}
      <aside className="hidden lg:flex w-[260px] flex-col bg-[#0f172a] text-slate-300 shadow-xl overflow-y-auto">
        <div className="px-5 py-5 sticky top-0 bg-[#0f172a] z-10 border-b border-slate-800">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">
              <Shield size={18} />
            </div>
            <div>
              <p className="font-bold tracking-tight leading-tight text-lg">SchoolOS</p>
              <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 mt-0.5">Platform Admin</p>
            </div>
          </div>
        </div>

        <div className="flex-1 py-4">
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
                          <Icon size={16} className={isActive ? "text-white" : "text-slate-400"} />
                          {item.label}
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#f4f6f8]">
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-slate-500 hover:text-slate-700">
              <Menu size={20} />
            </button>
            <h1 className="text-xl font-bold text-slate-800 hidden sm:block">Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-5">
            {/* Search Bar */}
            <div className="hidden md:flex relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" />
              <input 
                type="text" 
                placeholder="Search schools, users, invoices..." 
                className="w-80 bg-slate-50 border border-slate-200 rounded-full pl-9 pr-12 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-500">⌘</kbd>
                <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-500">K</kbd>
              </div>
            </div>

            <button className="relative text-slate-500 hover:text-slate-700 transition-colors">
              <Bell size={20} />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white">8</span>
            </button>

            <button className="text-slate-500 hover:text-slate-700 transition-colors hidden sm:block">
              <HelpCircle size={20} />
            </button>

            <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm shadow-sm cursor-pointer" onClick={logout}>
                PA
              </div>
              <div className="hidden sm:block cursor-pointer" onClick={logout}>
                <p className="text-sm font-semibold text-slate-700 leading-tight">Platform Admin</p>
                <p className="text-[11px] text-slate-500">Super Admin</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
