import React, { useState } from "react";
import { ModuleCrud } from "../components/ModuleCrud";

export const HR: React.FC = () => {
  const [tab, setTab] = useState<"staff" | "leave">("staff");
  const tabCls = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm ${active ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <HRHeader />
      <HRTabs tab={tab} setTab={setTab} tabCls={tabCls} />
      {tab === "staff" ? (
        <ModuleCrud title="Staff" apiPath="hr/staff"
          columns={[{ key: "employeeNo", label: "Emp #" }, { key: "firstName", label: "First" }, { key: "lastName", label: "Last" }, { key: "department", label: "Dept" }]}
          fields={[
            { name: "employeeNo", label: "Employee No", required: true },
            { name: "firstName", label: "First name", required: true },
            { name: "lastName", label: "Last name", required: true },
            { name: "department", label: "Department" },
          ]} />
      ) : (
        <ModuleCrud title="Leave requests" apiPath="hr/leave"
          columns={[{ key: "staffId", label: "Staff" }, { key: "status", label: "Status" }, { key: "startDate", label: "From", render: (r) => new Date(r.startDate).toLocaleDateString() }]}
          fields={[
            { name: "staffId", label: "Staff UUID", required: true },
            { name: "startDate", label: "Start", type: "date", required: true },
            { name: "endDate", label: "End", type: "date", required: true },
            { name: "reason", label: "Reason" },
          ]} />
      )}
    </div>
  );
};

function HRHeader() {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">Human Resources</h1>
        <p className="text-slate-400 mt-1">Staff directory and leave management</p>
      </div>
    </div>
  );
}

function HRTabs({ tab, setTab, tabCls }: { tab: string; setTab: (t: "staff" | "leave") => void; tabCls: (a: boolean) => string }) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => setTab("staff")} className={tabCls(tab === "staff")}>Staff</button>
      <button type="button" onClick={() => setTab("leave")} className={tabCls(tab === "leave")}>Leave</button>
    </div>
  );
}
