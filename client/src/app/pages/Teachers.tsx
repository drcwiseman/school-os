import React from "react";
import { useParams } from "react-router-dom";
import { ModuleCrud } from "../components/ModuleCrud";
import { useAuth } from "../state/AuthContext";

export const Teachers: React.FC = () => {
  const { hasPermission } = useAuth();
  const { schoolSlug } = useParams<{ schoolSlug: string }>();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Teachers</h1>
          <p className="text-slate-400 mt-1 text-sm">Teaching staff from HR (departments matching Teacher / Teaching / Academic).</p>
        </div>
        {hasPermission("hr.view") && (
          <a href={`/s/${schoolSlug}/hr`} className="btn-ghost text-sm">Full HR →</a>
        )}
      </div>
      <ModuleCrud
        title="Teaching staff"
        apiPath="hr/staff?teachingOnly=1"
        columns={[
          { key: "employeeNo", label: "Emp #" },
          { key: "firstName", label: "First" },
          { key: "lastName", label: "Last" },
          { key: "department", label: "Department" },
          { key: "email", label: "Email" },
        ]}
        fields={[
          { name: "employeeNo", label: "Employee No", required: true },
          { name: "firstName", label: "First name", required: true },
          { name: "lastName", label: "Last name", required: true },
          { name: "department", label: "Department" },
          { name: "email", label: "Email" },
        ]}
        emptyMessage="No teaching staff. Add employees in HR with department Teacher."
      />
    </div>
  );
};
