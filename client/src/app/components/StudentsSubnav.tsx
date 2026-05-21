import React from "react";
import { NavLink, useParams } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { MODULE_FEATURE_CODES } from "../../lib/module-features";

export const StudentsSubnav: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { moduleEnabled } = useAuth();
  const base = `/s/${schoolSlug}/students`;
  const tab = (isActive: boolean) =>
    `px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 backdrop-blur-md ${isActive ? "bg-primary-600 text-white shadow-lg shadow-primary-500/30 font-semibold" : "text-slate-400 hover:text-slate-200 hover:bg-white/5 dark:hover:bg-slate-850/40"}`;

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-700/40 pb-4 mb-6">
      <NavLink to={base} end className={({ isActive }) => tab(isActive)}>All Students</NavLink>
      <NavLink to={`/s/${schoolSlug}/parents`} className={({ isActive }) => tab(isActive)}>Parents</NavLink>
      <NavLink to={`${base}/leaves`} className={({ isActive }) => tab(isActive)}>Leaves</NavLink>
      <NavLink to={`${base}/birthdays`} className={({ isActive }) => tab(isActive)}>Birthdays</NavLink>
      <NavLink to={`${base}/noticeboard`} className={({ isActive }) => tab(isActive)}>Noticeboard</NavLink>
      <NavLink to={`${base}/transfers`} className={({ isActive }) => tab(isActive)}>Transfers</NavLink>
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
