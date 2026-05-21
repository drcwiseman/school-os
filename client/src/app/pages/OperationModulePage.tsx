import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { ModuleCrud, type ColumnDef, type FieldDef } from "../components/ModuleCrud";
import { OPERATIONS_MODULES, type OperationsModuleId } from "./operations-modules";

type OpsTab = { id: string; label: string; apiPath: string; columns: ColumnDef[]; fields: FieldDef[] };

const EXTRA_TABS: Partial<Record<OperationsModuleId, OpsTab[]>> = {
  library: [
    {
      id: "loans",
      label: "Loans",
      apiPath: "library/loans",
      columns: [
        { key: "studentId", label: "Student" },
        { key: "copyId", label: "Copy" },
        { key: "dueAt", label: "Due", render: (r) => r.dueAt ? new Date(r.dueAt as string).toLocaleDateString() : "—" },
        { key: "returnedAt", label: "Returned", render: (r) => (r.returnedAt ? "Yes" : "Active") },
      ],
      fields: [
        { name: "copyId", label: "Copy UUID", required: true },
        { name: "studentId", label: "Student UUID", required: true },
        { name: "dueAt", label: "Due date", type: "date" },
      ],
    },
  ],
  transport: [
    {
      id: "vehicles",
      label: "Vehicles",
      apiPath: "transport/vehicles",
      columns: [{ key: "registration", label: "Registration" }, { key: "capacity", label: "Capacity" }],
      fields: [
        { name: "registration", label: "Registration", required: true },
        { name: "capacity", label: "Capacity", type: "number" },
      ],
    },
    {
      id: "assignments",
      label: "Assignments",
      apiPath: "transport/assignments",
      columns: [
        { key: "routeId", label: "Route" },
        { key: "studentId", label: "Student" },
        { key: "stopId", label: "Stop" },
      ],
      fields: [
        { name: "routeId", label: "Route UUID", required: true },
        { name: "studentId", label: "Student UUID", required: true },
        { name: "stopId", label: "Stop UUID" },
      ],
    },
  ],
  boarding: [
    {
      id: "rooms",
      label: "Rooms",
      apiPath: "boarding/rooms",
      columns: [{ key: "name", label: "Room" }, { key: "houseId", label: "House" }, { key: "capacity", label: "Beds" }],
      fields: [
        { name: "houseId", label: "House UUID", required: true },
        { name: "name", label: "Room name", required: true },
        { name: "capacity", label: "Capacity", type: "number" },
      ],
    },
    {
      id: "allocations",
      label: "Allocations",
      apiPath: "boarding/allocations",
      columns: [{ key: "roomId", label: "Room" }, { key: "studentId", label: "Student" }],
      fields: [
        { name: "roomId", label: "Room UUID", required: true },
        { name: "studentId", label: "Student UUID", required: true },
      ],
    },
  ],
};

export const OperationModulePage: React.FC<{ moduleId: OperationsModuleId }> = ({ moduleId }) => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const mod = OPERATIONS_MODULES.find((m) => m.id === moduleId)!;
  const extras = EXTRA_TABS[moduleId] ?? [];
  const tabs = [{ id: "main", label: mod.label, apiPath: mod.path, columns: mod.columns, fields: mod.fields }, ...extras];
  const [tab, setTab] = useState(tabs[0].id);
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{mod.label}</h1>
          <p className="text-slate-400 mt-1">School operations — {schoolSlug}</p>
        </div>
      </div>
      {tabs.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm ${tab === t.id ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <ModuleCrud
        key={active.apiPath}
        title={active.label}
        apiPath={active.apiPath}
        columns={[...active.columns]}
        fields={[...active.fields]}
      />
    </div>
  );
};
