import React from "react";
import { ModuleCrud } from "../ModuleCrud";
import { useAcademicsLookups } from "./useAcademicsLookups";

export const TermsCrudPanel: React.FC = () => {
  const { years, loading } = useAcademicsLookups();

  if (loading) return <p className="text-slate-400">Loading…</p>;

  return (
    <ModuleCrud
      title="Terms"
      apiPath="academics/terms"
      allowEdit
      allowDelete
      editPermission="academics.manage"
      deletePermission="academics.manage"
      createPermission="academics.manage"
      columns={[
        { key: "name", label: "Term" },
        { key: "academicYearId", label: "Year", render: (r) => years.find((y) => y.id === r.academicYearId)?.name ?? "—" },
        { key: "isCurrent", label: "Current", render: (r) => (r.isCurrent ? "Yes" : "—") },
      ]}
      fields={[
        {
          name: "academicYearId",
          label: "Academic year",
          type: "select",
          required: true,
          options: years.map((y) => ({ value: y.id, label: y.name })),
        },
        { name: "name", label: "Name", required: true },
        { name: "startDate", label: "Start", type: "date", required: true },
        { name: "endDate", label: "End", type: "date", required: true },
      ]}
      emptyMessage={years.length === 0 ? "Add an academic year first." : "No terms yet."}
    />
  );
};
