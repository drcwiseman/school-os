import React from "react";
import { useAuth } from "../state/AuthContext";
import { Users, BookOpen, UserCheck, Activity } from "lucide-react";

export const Dashboard: React.FC = () => {
  const { user, schoolSlug } = useAuth();

  const stats = [
    { label: "Total Students", value: "1,248", icon: Users, color: "text-blue-400" },
    { label: "Attendance Today", value: "96.4%", icon: UserCheck, color: "text-emerald-400" },
    { label: "Active Courses", value: "32", icon: BookOpen, color: "text-indigo-400" },
    { label: "Recent Incidents", value: "3", icon: Activity, color: "text-red-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-slate-400 mt-1">Welcome back to {schoolSlug}, {user?.firstName}.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="card p-6 flex items-center gap-4 hover:border-slate-600 transition-colors cursor-default">
              <div className={`p-4 rounded-xl bg-slate-800/50 ${stat.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                <p className="text-2xl font-bold text-white mt-0.5">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6 min-h-[300px] flex items-center justify-center border-slate-700/60">
          <p className="text-slate-500 text-sm">Attendance Chart Placeholder</p>
        </div>
        <div className="card p-6 min-h-[300px]">
          <h3 className="font-semibold text-white mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-2" />
              <div>
                <p className="text-sm text-slate-300">New student enrolled</p>
                <p className="text-xs text-slate-500">2 mins ago</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
              <div>
                <p className="text-sm text-slate-300">Term 1 fees collected</p>
                <p className="text-xs text-slate-500">1 hour ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
