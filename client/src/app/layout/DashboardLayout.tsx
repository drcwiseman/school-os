import React from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "../components/GlobalSearch";
import { CampusSelector } from "../components/CampusSelector";
import { PwaInstallBanner } from "../components/PwaInstallBanner";
import { ThemeToggle } from "../components/ThemeToggle";
import { HeaderNotifications } from "../components/HeaderNotifications";
import { Loader2 } from "lucide-react";

export const DashboardLayout: React.FC = () => {
  const { user, loading, schoolSlug, impersonationReadOnly } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!user || !schoolSlug) {
    // Redirect to login preserving the attempted url
    const loginUrl = schoolSlug ? `/s/${schoolSlug}/login` : "/";
    return <Navigate to={loginUrl} state={{ from: location }} replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-surface p-8">
        <div className="max-w-6xl mx-auto">
          {impersonationReadOnly && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
              Platform shadow session — read-only. Changes are blocked.
            </div>
          )}
          <PwaInstallBanner />
          <div className="flex items-center justify-between gap-2 mb-4">
            <HeaderNotifications />
            <ThemeToggle />
          </div>
          <CampusSelector />
          <GlobalSearch />
          <Outlet />
        </div>
      </main>
    </div>
  );
};
