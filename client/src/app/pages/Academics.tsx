import React, { useState } from "react";
import { ModuleCrud } from "../components/ModuleCrud";
import { StreamsPanel } from "../components/StreamsPanel";
import { TeacherAssignPanel, RosterPanel, TimetableBuilderPanel, LessonLogPanel, SmartDevicesPanel, SeatingPanel } from "../components/academics/ClassroomPanels";
import { AcademicsHub } from "../components/academics/AcademicsHub";
import { OnlineClassesPanel, StudyMaterialsPanel } from "../components/academics/LearningResourcesPanels";
import { useParams } from "react-router-dom";

const TABS = ["overview", "live", "materials", "years", "terms", "classes", "streams", "teachers", "roster", "seating", "timetable", "lessons", "devices", "subjects", "rooms", "assignments"] as const;

export const Academics: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [tab, setTab] = useState<(typeof TABS)[number]>("overview");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Academics</h1>
          <p className="text-slate-400 mt-1">Academic years, classes, timetables, study materials, live classes, and homework</p>
        </div>
      </div>

      <TabBar tab={tab} setTab={setTab} />

      {tab === "overview" && schoolSlug && (
        <AcademicsHub schoolSlug={schoolSlug} onOpenTab={(t) => setTab(t as (typeof TABS)[number])} />
      )}
      {tab === "live" && <OnlineClassesPanel />}
      {tab === "materials" && <StudyMaterialsPanel />}

      {tab === "years" && (
        <ModuleCrud title="Academic years" apiPath="academics/years"
          columns={[
            { key: "name", label: "Year" },
            { key: "isCurrent", label: "Current", render: (r) => (r.isCurrent ? "Yes" : "—") },
            { key: "startDate", label: "Start", render: (r) => new Date(r.startDate).toLocaleDateString() },
          ]}
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "startDate", label: "Start date", type: "date", required: true },
            { name: "endDate", label: "End date", type: "date", required: true },
            { name: "isCurrent", label: "Current (true/false)" },
          ]} />
      )}
      {tab === "terms" && (
        <ModuleCrud title="Terms" apiPath="academics/terms"
          columns={[
            { key: "name", label: "Term" },
            { key: "academicYearId", label: "Year ID" },
            { key: "isCurrent", label: "Current", render: (r) => (r.isCurrent ? "Yes" : "—") },
          ]}
          fields={[
            { name: "academicYearId", label: "Academic year UUID", required: true },
            { name: "name", label: "Name", required: true },
            { name: "startDate", label: "Start", type: "date", required: true },
            { name: "endDate", label: "End", type: "date", required: true },
          ]} />
      )}
      {tab === "classes" && (
        <ModuleCrud title="Classes" apiPath="academics/classes"
          columns={[{ key: "name", label: "Class" }, { key: "level", label: "Level" }]}
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "level", label: "Level", type: "number" },
          ]} />
      )}
      {tab === "streams" && <StreamsPanel />}
      {tab === "teachers" && <TeacherAssignPanel />}
      {tab === "roster" && <RosterPanel />}
      {tab === "seating" && <SeatingPanel />}
      {tab === "timetable" && <TimetableBuilderPanel />}
      {tab === "lessons" && <LessonLogPanel />}
      {tab === "devices" && <SmartDevicesPanel />}
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
      {tab === "assignments" && (
        <ModuleCrud title="Assignments" apiPath="academics/assignments"
          columns={[{ key: "title", label: "Title" }, { key: "description", label: "Details", render: (r) => (r.description ?? "").slice(0, 40) }, { key: "dueDate", label: "Due", render: (r) => r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "—" }]}
          fields={[
            { name: "title", label: "Title", required: true },
            { name: "description", label: "Description" },
            { name: "classId", label: "Class UUID", required: true },
            { name: "subjectId", label: "Subject UUID", required: true },
            { name: "dueDate", label: "Due date", type: "date" },
          ]} />
      )}
    </div>
  );
};

function TabBar({ tab, setTab }: { tab: string; setTab: (t: (typeof TABS)[number]) => void }) {
  const labels: Record<(typeof TABS)[number], string> = {
    overview: "Overview",
    live: "Live classes",
    materials: "Study material",
    years: "Years",
    terms: "Terms",
    classes: "Classes",
    streams: "Streams",
    teachers: "Teachers",
    roster: "Roster",
    seating: "Seating",
    timetable: "Timetable",
    lessons: "Lessons",
    devices: "Devices",
    subjects: "Subjects",
    rooms: "Rooms",
    assignments: "Homework",
  };
  return (
    <div className="flex gap-2 flex-wrap">
      {TABS.map((t) => (
        <button key={t} type="button" onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm ${tab === t ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`}>
          {labels[t]}
        </button>
      ))}
    </div>
  );
};
