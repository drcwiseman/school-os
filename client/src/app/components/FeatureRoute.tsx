import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { Layers } from "lucide-react";

/** Blocks direct URL access when subscription feature is not enabled. */
export const FeatureRoute: React.FC<{
  feature: string;
  children: React.ReactNode;
}> = ({ feature, children }) => {
  const { moduleEnabled, schoolSlug, loading, hasPermission } = useAuth();

  if (loading) return null;
  if (!moduleEnabled(feature)) {
    return (
      <div className="card p-8 max-w-lg mx-auto text-center space-y-4">
        <Layers className="w-10 h-10 text-slate-500 mx-auto" />
        <h2 className="text-lg font-semibold text-white">Module not enabled</h2>
        <p className="text-sm text-slate-400">
          <span className="font-mono text-slate-300">{feature}</span> is not on your school plan.
          {hasPermission("settings.manage") && " Enable it under Settings → Modules."}
        </p>
        <Link to={`/s/${schoolSlug}/dashboard`} className="btn-primary inline-block text-sm">
          Back to dashboard
        </Link>
      </div>
    );
  }
  return <>{children}</>;
};
