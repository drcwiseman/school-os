import React, { useState } from "react";
import { ModuleCrud } from "../components/ModuleCrud";
import { StreamsPanel } from "../components/StreamsPanel";
import { TeacherAssignPanel, RosterPanel, TimetableBuilderPanel, LessonLogPanel, SmartDevicesPanel, SeatingPanel } from "../components/academics/ClassroomPanels";
import { AcademicsHub } from "../components/academics/AcademicsHub";
import { OnlineClassesPanel, StudyMaterialsPanel } from "../components/academics/LearningResourcesPanels";
import { EventsPanel } from "../components/academics/EventsPanel";
import { HomeworkGradingPanel } from "../components/academics/HomeworkGradingPanel";
import { AcademicsSetupBanner } from "../components/academics/AcademicsSetupBanner";
import { HomeworkAssignmentsPanel } from "../components/academics/HomeworkAssignmentsPanel";
import { TermsCrudPanel } from "../components/academics/TermsCrudPanel";
import { useParams } from "react-router-dom";

const TABS = ["overview", "live", "materials", "homework", "grading", "events", "years", "terms", "classes", "streams", "teachers", "roster", "seating", "timetable", "lessons", "devices", "subjects", "rooms"] as const;

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

      {schoolSlug && <AcademicsSetupBanner schoolSlug={schoolSlug} />}

      {tab === "overview" && schoolSlug && (
        <AcademicsHub schoolSlug={schoolSlug} onOpenTab={(t) => setTab(t as (typeof TABS)[number])} />
      )}
      {tab === "live" && <OnlineClassesPanel />}
      {tab === "materials" && <StudyMaterialsPanel />}
      {tab === "grading" && <HomeworkGradingPanel />}
      {tab === "events" && <EventsPanel />}

      {tab === "years" && (
        <ModuleCrud title="Academic years" apiPath="academics/years"
          allowEdit allowDelete editPermission="academics.manage" deletePermission="academics.manage" createPermission="academics.manage"
          columns={[
            { key: "name", label: "Year" },
            { key: "isCurrent", label: "Current", render: (r) => (r.isCurrent ? "Yes" : "—") },
            { key: "startDate", label: "Start", render: (r) => new Date(r.startDate).toLocaleDateString() },
          ]}
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "startDate", label: "Start date", type: "date", required: true },
            { name: "endDate", label: "End date", type: "date", required: true },
          ]} />
      )}
      {tab === "terms" && <TermsCrudPanel />}
      {tab === "classes" && (
        <ModuleCrud title="Classes" apiPath="academics/classes"
          allowEdit allowDelete editPermission="academics.manage" deletePermission="academics.manage" createPermission="academics.manage"
          columns={[{ key: "name", label: "Class" }, { key: "level", label: "Level" }]}
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "level", label: "Level", type: "number" },
          ]}
          emptyMessage="No classes — add one or load demo data from Admin." />
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
          allowEdit allowDelete editPermission="academics.manage" deletePermission="academics.manage" createPermission="academics.manage"
          columns={[{ key: "code", label: "Code" }, { key: "name", label: "Name" }]}
          fields={[{ name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true }]} />
      )}
      {tab === "rooms" && (
        <ModuleCrud title="Rooms" apiPath="academics/rooms"
          allowEdit allowDelete editPermission="academics.manage" deletePermission="academics.manage" createPermission="academics.manage"
          columns={[{ key: "name", label: "Room" }, { key: "capacity", label: "Capacity" }]}
          fields={[{ name: "name", label: "Name", required: true }, { name: "capacity", label: "Capacity", type: "number" }]} />
      )}
      {tab === "homework" && <HomeworkAssignmentsPanel />}
    </div>
  );
};

function TabBar({ tab, setTab }: { tab: string; setTab: (t: (typeof TABS)[number]) => void }) {
  const labels: Record<(typeof TABS)[number], string> = {
    overview: "Overview",
    live: "Live classes",
    materials: "Study material",
    grading: "Grade homework",
    events: "Events",
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
    homework: "Create homework",
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
