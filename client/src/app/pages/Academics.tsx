import React, { useState } from "react";
import { ModuleCrud } from "../components/ModuleCrud";

const TABS = ["subjects", "rooms", "timetables", "assignments"] as const;

export const Academics: React.FC = () => {
  const [tab, setTab] = useState<(typeof TABS)[number]>("subjects");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Academics</h1>
          <p className="text-slate-400 mt-1">Subjects, rooms, timetables, and assignments</p>
        </div>
      </div>

      <TabBar tab={tab} setTab={setTab} />

      {tab === "subjects" && (
        <ModuleCrud title="Subjects" apiPath="academics/subjects"
          columns={[{ key: "code", label: "Code" }, { key: "name", label: "Name" }]}
          fields={[{ name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true }]} />
      )}
      {tab === "rooms" && (
        <ModuleCrud title="Rooms" apiPath="academics/rooms"
          columns={[{ key: "name", label: "Room" }, { key: "capacity", label: "Capacity" }]}
          fields={[{ name: "name", label: "Name", required: true }, { name: "capacity", label: "Capacity", type: "number" }]} />
      )}
      {tab === "timetables" && (
        <ModuleCrud title="Timetables" apiPath="academics/timetables"
          columns={[{ key: "name", label: "Name" }, { key: "classId", label: "Class ID" }]}
          fields={[{ name: "name", label: "Name", required: true }, { name: "classId", label: "Class UUID", required: true }]} />
      )}
      {tab === "assignments" && (
        <ModuleCrud title="Assignments" apiPath="academics/assignments"
          columns={[{ key: "title", label: "Title" }, { key: "dueDate", label: "Due", render: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "—" }]}
          fields={[
            { name: "title", label: "Title", required: true },
            { name: "classId", label: "Class UUID", required: true },
            { name: "subjectId", label: "Subject UUID", required: true },
            { name: "dueDate", label: "Due date", type: "date" },
          ]} />
      )}
    </div>
  );
};

function TabBar({ tab, setTab }: { tab: string; setTab: (t: (typeof TABS)[number]) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {TABS.map((t) => (
        <button key={t} type="button" onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm capitalize ${tab === t ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`}>
          {t}
        </button>
      ))}
    </div>
  );
}
