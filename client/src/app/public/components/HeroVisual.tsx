import React from "react";
import {
  BarChart3,
  BookOpen,
  FileText,
  GraduationCap,
  Users,
  Wallet,
} from "lucide-react";

const FLOATING_MODULES = [
  { label: "Academics & Exams", icon: BookOpen, color: "bg-amber-100 text-amber-700" },
  { label: "Financial Engine", icon: Wallet, color: "bg-sky-100 text-sky-700" },
  { label: "HR & Payroll", icon: Users, color: "bg-violet-100 text-violet-700" },
  { label: "Report Cards PDF", icon: FileText, color: "bg-rose-100 text-rose-700" },
] as const;

/** Layered product preview — Classe365 / Teach'n Go style */
export const HeroVisual: React.FC = () => (
  <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -right-4 top-8 z-20 hidden w-52 animate-float lg:block" style={{ animationDelay: "0.5s" }}>
      <div className="rounded-2xl border border-marketing-primary/10 bg-white p-4 shadow-marketing-lg ring-1 ring-marketing-primary/5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-marketing-navy/45">Modules</p>
        <ul className="mt-3 space-y-2.5">
          {FLOATING_MODULES.map((m) => (
            <li key={m.label} className="flex items-center gap-2.5 text-sm font-medium text-marketing-navy">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${m.color}`}>
                <m.icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span className="leading-tight">{m.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>

    <div className="relative animate-float">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-marketing-primary/20 via-transparent to-marketing-accent/15 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/80 bg-white p-2 shadow-marketing-lg ring-1 ring-marketing-primary/10">
        <div className="rounded-xl bg-gradient-to-br from-[#1e3a5f] via-marketing-navy to-[#162a45] p-5 text-white">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-marketing-sage/90">
              Exams · Term 2
            </span>
            <span className="rounded-full bg-marketing-accent px-2.5 py-0.5 text-[10px] font-semibold">
              Live
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Students", value: "1,248", icon: Users },
              { label: "Reports", value: "412", icon: FileText },
              { label: "Avg.", value: "78%", icon: BarChart3 },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-white/10 p-2.5 backdrop-blur-sm">
                <s.icon className="mb-1 h-4 w-4 text-marketing-sage" />
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-[9px] uppercase tracking-wide text-white/50">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {[88, 72, 65].map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-white/50">
                <GraduationCap className="h-3 w-3 shrink-0" />
                <span className="w-12">Grade {10 - i}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-marketing-accent to-marketing-sage transition-all duration-1000"
                    style={{ width: `${w}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    <div
      className="absolute -bottom-3 -left-4 animate-float rounded-2xl border border-white/80 bg-white px-4 py-3 shadow-marketing-lg"
      style={{ animationDelay: "1.2s" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-marketing-accent">PDF Export</p>
      <p className="font-heading text-sm font-semibold text-marketing-navy">412 report cards · 12s</p>
    </div>
  </div>
);
