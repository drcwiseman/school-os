import React from "react";
import { Outlet } from "react-router-dom";
import { PublicHeader } from "../components/PublicHeader";
import { PublicFooter } from "../components/PublicFooter";
export const PublicLayout: React.FC = () => (
  <div className="marketing-page flex min-h-screen flex-col">
    <PublicHeader />
    <main className="flex-1">
      <Outlet />
    </main>
    <PublicFooter />
  </div>
);
