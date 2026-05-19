import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { PublicHeader } from "../components/PublicHeader";
import { PublicFooter } from "../components/PublicFooter";
export const PublicLayout: React.FC = () => {
  useEffect(() => {
    document.body.classList.add("marketing-active");
    return () => document.body.classList.remove("marketing-active");
  }, []);

  return (
    <div className="marketing-page flex min-h-screen flex-col">
      <PublicHeader />
      <main className="relative z-10 flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
};
