import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { getTenantBootstrap } from "../lib/tenant-host";

/** Only render child routes when the server injected a school on this host. */
export const CustomDomainShell: React.FC = () => {
  const boot = getTenantBootstrap();
  if (!boot?.slug) return <Navigate to="/" replace />;
  return <Outlet />;
};
