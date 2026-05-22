import React, { useEffect, useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "../components/GlobalSearch";
import { CampusSelector } from "../components/CampusSelector";
import { PwaInstallBanner } from "../components/PwaInstallBanner";
import { ThemeToggle } from "../components/ThemeToggle";
import { HeaderNotifications } from "../components/HeaderNotifications";
import { Loader2, Menu, X } from "lucide-react";
import { schoolPath } from "../lib/tenant-host";

export const DashboardLayout: React.FC = () => {
  const { user, loading, schoolSlug, impersonationReadOnly } = useAuth();
  const location = useLocation();
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    setMobileNav(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!user || !schoolSlug) {
    // Redirect to login preserving the attempted url
    const loginUrl = schoolSlug ? schoolPath(schoolSlug, "login") : "/";
    return <Navigate to={loginUrl} state={{ from: location }} replace />;
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-surface">
      {mobileNav && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNav(false)}
        />
      )}
      <Sidebar mobileOpen={mobileNav} onMobileClose={() => setMobileNav(false)} />
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden shrink-0 flex items-center gap-3 border-b border-slate-800 bg-surface px-4 py-3">
          <button
            type="button"
            className="p-2 rounded-lg border border-slate-700 text-slate-300"
            onClick={() => setMobileNav((o) => !o)}
            aria-label={mobileNav ? "Close menu" : "Open menu"}
          >
            {mobileNav ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">School OS</p>
            <p className="text-[10px] text-slate-500 uppercase truncate">{schoolSlug}</p>
          </div>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-surface p-4 sm:p-6 md:p-8 min-w-0">
          <div className="w-full max-w-[min(100%,1600px)] mx-auto min-w-0">
            {impersonationReadOnly && (
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
                Platform shadow session — read-only. Changes are blocked.
              </div>
            )}
            <PwaInstallBanner />
            <div className="hidden lg:flex items-center justify-end gap-2 mb-4">
              <HeaderNotifications />
              <ThemeToggle />
            </div>
            <div className="lg:hidden mb-3">
              <HeaderNotifications />
            </div>
            <CampusSelector />
            <GlobalSearch />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
