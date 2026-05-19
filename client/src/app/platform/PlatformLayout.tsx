import React, { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Receipt,
  LifeBuoy,
  ListTodo,
  ScrollText,
  Loader2,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { usePlatformAuth } from "./hooks/usePlatformAuth";

const nav = [
  { to: "/platform/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/platform/tenants", label: "Schools", icon: Building2 },
  { to: "/platform/subscriptions/plans", label: "Plans & pricing", icon: CreditCard },
  { to: "/platform/subscriptions/ledger", label: "Revenue", icon: Receipt },
  { to: "/platform/support", label: "Support", icon: LifeBuoy },
  { to: "/platform/system/queue", label: "Job queue", icon: ListTodo },
  { to: "/platform/system/audit", label: "Audit log", icon: ScrollText },
];

export const PlatformLayout: React.FC = () => {
  const { ready, admin, logout } = usePlatformAuth();

  useEffect(() => {
    document.body.classList.add("platform-active");
    return () => document.body.classList.remove("platform-active");
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      <div className="flex min-h-screen">
        <aside className="hidden lg:flex w-64 flex-col border-r border-slate-200 bg-white">
          <div className="px-5 py-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold text-sm">
                SO
              </div>
              <div>
                <p className="font-semibold text-slate-900 leading-tight">SchoolOS</p>
                <p className="text-xs text-slate-500">Platform admin</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-0.5">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`
                  }
                >
                  <Icon size={18} className="shrink-0 opacity-80" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-100">
            <p className="text-xs font-medium text-slate-900 truncate">{admin?.name ?? "Operator"}</p>
            <p className="text-xs text-slate-500 truncate">{admin?.email}</p>
            <button
              type="button"
              onClick={logout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="lg:hidden flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">SO</div>
                <span className="font-semibold">SchoolOS Platform</span>
              </div>
              <p className="hidden lg:block text-sm text-slate-500">
                Manage schools, subscriptions, and platform operations
              </p>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  <RefreshCw size={16} /> Refresh
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="lg:hidden inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </header>

          <nav className="lg:hidden flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-medium ${
                    isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};
