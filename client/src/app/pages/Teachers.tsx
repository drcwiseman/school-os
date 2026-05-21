import React from "react";
import { Link, useParams } from "react-router-dom";
import { ModuleCrud } from "../components/ModuleCrud";
import { useAuth } from "../state/AuthContext";
import { GraduationCap } from "lucide-react";

export const Teachers: React.FC = () => {
  const { hasPermission } = useAuth();
  const { schoolSlug } = useParams<{ schoolSlug: string }>();

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-amber-500/10 via-transparent to-transparent -z-10" />

      <header className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-amber-400" />
            Teachers
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Teaching staff from HR — departments like Teacher, Teaching, or Academic.
          </p>
        </div>
        {hasPermission("hr.view") && (
          <Link
            to={`/s/${schoolSlug}/hr`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/40 text-slate-200 text-sm font-semibold hover:bg-slate-800 transition-all"
          >
            Full HR →
          </Link>
        )}
      </header>

      <ModuleCrud
        title="Teaching staff"
        apiPath="hr/staff"
        listQuery="teachingOnly=1"
        columns={[
          { key: "employeeNo", label: "Emp #" },
          { key: "firstName", label: "First" },
          { key: "lastName", label: "Last" },
          { key: "department", label: "Department" },
          { key: "jobTitle", label: "Job title" },
          { key: "email", label: "Email" },
        ]}
        fields={[
          { name: "employeeNo", label: "Employee No", required: true },
          { name: "firstName", label: "First name", required: true },
          { name: "lastName", label: "Last name", required: true },
          { name: "department", label: "Department" },
          { name: "jobTitle", label: "Job title" },
          { name: "email", label: "Email" },
        ]}
        emptyMessage="No teaching staff. Add with department Teacher or link from HR."
        allowEdit
        allowDelete
        createPermission="hr.manage"
        editPermission="hr.manage"
        deletePermission="hr.manage"
      />
    </div>
  );
};
