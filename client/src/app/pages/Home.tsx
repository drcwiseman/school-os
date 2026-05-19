import React from "react";
import { Link } from "react-router-dom";
import { Building2, GraduationCap, Users } from "lucide-react";

export const Home: React.FC = () => (
  <div className="min-h-screen bg-surface flex items-center justify-center p-6">
    <div className="max-w-lg w-full card p-8 space-y-6 text-center">
      <h1 className="text-3xl font-bold text-white">School OS</h1>
      <p className="text-slate-400 text-sm">Multi-tenant school management — choose how to sign in</p>
      <div className="grid gap-3 text-left">
        <Link to="/s/school-a/login" className="btn-primary justify-center gap-2">
          <GraduationCap className="w-4 h-4" /> Staff — Greenfield Academy
        </Link>
        <Link to="/s/school-b/login" className="btn-ghost justify-center gap-2 border border-slate-700">
          <GraduationCap className="w-4 h-4" /> Staff — Sunridge High
        </Link>
        <Link to="/s/school-a/portal/login" className="btn-ghost justify-center gap-2 border border-slate-700">
          <Users className="w-4 h-4" /> Parent / Student portal
        </Link>
        <Link to="/platform/login" className="btn-ghost justify-center gap-2 border border-slate-700">
          <Building2 className="w-4 h-4" /> Platform console
        </Link>
      </div>
    </div>
  </div>
);
