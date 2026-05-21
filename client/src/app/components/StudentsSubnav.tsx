import React from "react";
import { NavLink, useParams } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { MODULE_FEATURE_CODES } from "../../lib/module-features";

export const StudentsSubnav: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { moduleEnabled } = useAuth();
  const base = `/s/${schoolSlug}/students`;
  const tab = (isActive: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition ${isActive ? "bg-primary-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-800"}`;

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-800 pb-4 mb-6">
      <NavLink to={base} end className={({ isActive }) => tab(isActive)}>All Students</NavLink>
      <NavLink to={`${base}/new`} className={({ isActive }) => tab(isActive)}>Add / Admission</NavLink>
      <NavLink to={`${base}/promote`} className={({ isActive }) => tab(isActive)}>Promotion wizard</NavLink>
      {moduleEnabled(MODULE_FEATURE_CODES.admissions) && (
        <NavLink to={`/s/${schoolSlug}/admissions`} className={({ isActive }) => tab(isActive)}>
          Admissions pipeline
        </NavLink>
      )}
    </nav>
  );
};
