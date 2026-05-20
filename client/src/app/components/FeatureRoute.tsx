import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

/** Blocks direct URL access when subscription feature is not enabled. */
export const FeatureRoute: React.FC<{
  feature: string;
  children: React.ReactNode;
}> = ({ feature, children }) => {
  const { moduleEnabled, schoolSlug, loading } = useAuth();

  if (loading) return null;
  if (!moduleEnabled(feature)) {
    return <Navigate to={`/s/${schoolSlug}/dashboard`} replace />;
  }
  return <>{children}</>;
};
