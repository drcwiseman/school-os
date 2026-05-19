import React from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { Sidebar } from "./Sidebar";
import { Loader2 } from "lucide-react";

export const DashboardLayout: React.FC = () => {
  const { user, loading, schoolSlug } = useAuth();
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
          <Outlet />
        </div>
      </main>
    </div>
  );
};
