import React from "react";
import { ModuleCrud } from "../ModuleCrud";
import { useAcademicsLookups } from "./useAcademicsLookups";

export const HomeworkAssignmentsPanel: React.FC = () => {
  const { classes, subjects, loading } = useAcademicsLookups();

  if (loading) return <p className="text-slate-400">Loading…</p>;

  return (
    <ModuleCrud
      title="Homework assignments"
      apiPath="academics/assignments"
      allowEdit
      allowDelete
      editPermission="academics.manage"
      deletePermission="academics.manage"
      createPermission="academics.manage"
      columns={[
        { key: "title", label: "Title" },
        { key: "description", label: "Details", render: (r) => (r.description ?? "").slice(0, 40) },
        { key: "dueDate", label: "Due", render: (r) => (r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "—") },
      ]}
      fields={[
        { name: "title", label: "Title", required: true },
        { name: "description", label: "Description" },
        {
          name: "classId",
          label: "Class",
          type: "select",
          required: true,
          options: classes.map((c) => ({ value: c.id, label: c.name })),
        },
        {
          name: "subjectId",
          label: "Subject",
          type: "select",
          required: true,
          options: subjects.map((s) => ({ value: s.id, label: s.name })),
        },
        { name: "dueDate", label: "Due date", type: "date" },
      ]}
      emptyMessage="No homework yet — create an assignment above."
    />
  );
};
