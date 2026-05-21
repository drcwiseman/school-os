import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ModuleCrud } from "../components/ModuleCrud";
import { useAuth } from "../state/AuthContext";
import { api } from "../api/client";
import { GraduationCap, Info } from "lucide-react";

export const Teachers: React.FC = () => {
  const { hasPermission } = useAuth();
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [hrTotal, setHrTotal] = useState<number | null>(null);
  const [teachingCount, setTeachingCount] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!schoolSlug || !hasPermission("hr.view")) return;
    Promise.all([
      api.get(`/s/${schoolSlug}/api/hr/staff`),
      api.get(`/s/${schoolSlug}/api/hr/staff?teachingOnly=1`),
    ])
      .then(([all, teaching]) => {
        setHrTotal((all.data ?? []).length);
        setTeachingCount((teaching.data ?? []).length);
        setApiError(null);
      })
      .catch((err: any) => {
        setApiError(err.message ?? "Could not load staff");
        setHrTotal(null);
        setTeachingCount(null);
      });
  }, [schoolSlug, hasPermission]);

  const emptyHint = () => {
    if (apiError) {
      return (
        <span>
          Staff API error: <strong className="text-red-400">{apiError}</strong>. On the server run{" "}
          <code className="text-xs bg-slate-800 px-1 rounded">npm run db:repair --prefix server</code> then restart the app.
        </span>
      );
    }
    if (hrTotal === 0) {
      return (
        <span>
          No employees in HR yet. Click <strong>+ Add</strong> below, open{" "}
          <Link to={`/s/${schoolSlug}/hr`} className="text-amber-400 hover:underline">Full HR</Link>, or go to{" "}
          <Link to={`/s/${schoolSlug}/admin`} className="text-amber-400 hover:underline">Admin → Utilities</Link> and run{" "}
          <strong>Load demo data</strong> (then refresh).
        </span>
      );
    }
    if (hrTotal != null && hrTotal > 0 && teachingCount === 0) {
      return (
        <span>
          HR has <strong>{hrTotal}</strong> employee(s), but none match the teaching filter. Set{" "}
          <strong>Department</strong> to Teacher, Teaching, Headteacher, or Academic in{" "}
          <Link to={`/s/${schoolSlug}/hr`} className="text-amber-400 hover:underline">HR</Link>.
        </span>
      );
    }
    return null;
  };

  const hint = emptyHint();

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
            Teaching staff from HR — departments like Teacher, Teaching, Headteacher, or Academic.
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

      {hint && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3 text-sm text-amber-100/90">
          <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>{hint}</div>
        </div>
      )}

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
          { name: "department", label: "Department (use Teacher)" },
          { name: "jobTitle", label: "Job title" },
          { name: "email", label: "Email" },
        ]}
        emptyMessage="No teaching staff yet — use + Add or load demo data (see banner above)."
        allowEdit
        allowDelete
        createPermission="hr.manage"
        editPermission="hr.manage"
        deletePermission="hr.manage"
      />
    </div>
  );
};
