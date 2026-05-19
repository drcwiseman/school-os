import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Shield, Activity, Server, Layers, LifeBuoy, Database, Loader2, RefreshCw,
} from "lucide-react";
import { usePlatformAuth } from "./hooks/usePlatformAuth";

const nav = [
  { to: "/platform/dashboard", label: "Command Center", icon: Activity, end: true },
  { to: "/platform/tenants", label: "Schools", icon: Server },
  { to: "/platform/subscriptions/plans", label: "Plans & FX", icon: Layers },
  { to: "/platform/subscriptions/ledger", label: "Revenue Ledger", icon: Layers },
  { to: "/platform/support", label: "Support", icon: LifeBuoy },
  { to: "/platform/system/queue", label: "Job Queue", icon: Database },
  { to: "/platform/system/audit", label: "Audit Trail", icon: Database },
];

export const PlatformLayout: React.FC = () => {
  const { ready, admin, logout } = usePlatformAuth();

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#070b13] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 font-sans antialiased selection:bg-blue-500/30">
      <header className="border-b border-slate-900 bg-[#090f1c]/80 backdrop-blur-md sticky top-0 z-50 px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-600/20">
            <Shield size={22} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              SchoolOS Platform
              <span className="text-[10px] bg-slate-800 text-slate-400 font-normal px-2 py-0.5 rounded">SaaS Console</span>
            </h1>
            <p className="text-xs text-slate-400">
              {admin?.name ?? "Operator"} · macro control only — not tenant ERP
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="flex items-center gap-2 text-xs bg-slate-900 border border-slate-800 hover:bg-slate-800 px-3 py-2 rounded-lg text-slate-300">
            <RefreshCw size={14} /> Sync
          </button>
          <button type="button" onClick={logout} className="text-xs bg-rose-600/10 border border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white px-3 py-2 rounded-lg">
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-6">
        <nav className="lg:w-52 shrink-0 flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border border-transparent"
                  }`
                }
              >
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
