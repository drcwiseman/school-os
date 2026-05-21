import React from "react";
import { Link } from "react-router-dom";
import {
  Video, FileText, Calendar, BookOpen, ClipboardList, ListChecks, UserCheck, CalendarDays,
} from "lucide-react";

export const ACADEMIC_MODULES = [
  {
    id: "live",
    title: "Online Live Classes",
    description: "Conduct interactive virtual sessions with attendance and performance tracking.",
    icon: Video,
    tab: "live" as const,
  },
  {
    id: "materials",
    title: "Study Material",
    description: "Upload, organize, and share digital notes, PDFs, and media resources.",
    icon: FileText,
    tab: "materials" as const,
  },
  {
    id: "timetable",
    title: "Class Timetable",
    description: "Create, edit, and manage class schedules across subjects and sections.",
    icon: Calendar,
    tab: "timetable" as const,
  },
  {
    id: "subjects",
    title: "Subjects (Class-wise)",
    description: "Assign subjects to specific classes with linked teachers and resources.",
    icon: BookOpen,
    tab: "subjects" as const,
  },
  {
    id: "assignments",
    title: "Homework Management",
    description: "Assign, collect, and evaluate homework submissions efficiently.",
    icon: ClipboardList,
    tab: "homework" as const,
  },
  {
    id: "lessons",
    title: "Lesson Management",
    description: "Structure lessons and maintain progress tracking for each subject.",
    icon: ListChecks,
    tab: "lessons" as const,
  },
  {
    id: "attendance",
    title: "Attendance",
    description: "Mark daily attendance and generate reports for students and staff.",
    icon: UserCheck,
    externalPath: "attendance" as const,
  },
  {
    id: "events",
    title: "Events",
    description: "Plan and share details of academic and cultural events with stakeholders.",
    icon: CalendarDays,
    tab: "events" as const,
  },
] as const;

type HubProps = {
  schoolSlug: string;
  onOpenTab: (tab: string) => void;
};

export const AcademicsHub: React.FC<HubProps> = ({ schoolSlug, onOpenTab }) => {
  const base = `/s/${schoolSlug}`;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-700/60 bg-gradient-to-br from-slate-900/80 to-indigo-950/30 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary-400">Academic &amp; Learning</p>
        <h2 className="mt-2 text-xl font-bold text-white">Explore a new era of learning</h2>
        <p className="mt-2 text-sm text-slate-400 max-w-2xl">
          Smarter tools, real-time insights, and a connected community for every educator — all in one admin workspace.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ACADEMIC_MODULES.map((m) => {
          const Icon = m.icon;
          const inner = (
            <div className="card p-5 h-full flex flex-col transition hover:border-primary-500/40 hover:bg-slate-900/60">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600/20 text-primary-300 mb-3">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white text-sm">{m.title}</h3>
              <p className="text-xs text-slate-500 mt-2 flex-1 leading-relaxed">{m.description}</p>
              <span className="text-xs text-primary-400 mt-3 font-medium">Open →</span>
            </div>
          );
          if ("externalPath" in m) {
            return (
              <Link key={m.id} to={`${base}/${m.externalPath}`}>
                {inner}
              </Link>
            );
          }
          return (
            <button key={m.id} type="button" className="text-left" onClick={() => onOpenTab(m.tab)}>
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
};
