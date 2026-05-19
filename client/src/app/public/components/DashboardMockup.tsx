import React from "react";
import { BarChart3, FileText, Users } from "lucide-react";

/** Layered dashboard preview for hero */
export const DashboardMockup: React.FC = () => (
  <div className="relative w-full max-w-md">
    <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-marketing-sage/20 via-transparent to-marketing-burgundy/15 blur-2xl" />
    <div className="relative animate-float">
      <div className="glass-card-elevated overflow-hidden p-2">
        <div className="rounded-2xl bg-marketing-navy p-5 text-marketing-cream shadow-inner">
          <div className="mb-5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-marketing-sage">
              Exams · Term 2
            </span>
            <span className="rounded-full bg-marketing-burgundy px-2.5 py-0.5 text-[10px] font-semibold">
              Live
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "Students", value: "1,248", icon: Users },
              { label: "Reports", value: "412", icon: FileText },
              { label: "Avg. score", value: "78%", icon: BarChart3 },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-white/10 p-2.5 backdrop-blur-sm">
                <s.icon className="mb-1.5 h-4 w-4 text-marketing-sage" strokeWidth={1.5} />
                <p className="text-base font-semibold">{s.value}</p>
                <p className="text-[9px] uppercase tracking-wide text-marketing-cream/50">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2.5">
            {[92, 78, 65, 88].map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className="w-14 text-marketing-cream/45">Gr. {10 - i}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-marketing-sage to-marketing-sage/70" style={{ width: `${w}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
    <div
      className="glass-card-elevated absolute -bottom-4 -left-6 w-48 animate-float p-4"
      style={{ animationDelay: "1.2s" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-marketing-sage">PDF Export</p>
      <p className="font-display text-base font-semibold text-marketing-navy">Report cards</p>
      <p className="mt-1 text-xs text-marketing-navy/55">412 generated · 12s</p>
    </div>
    <div
      className="glass-card-elevated absolute -right-4 top-10 w-44 animate-float p-4"
      style={{ animationDelay: "2.4s" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-marketing-burgundy">Finance</p>
      <p className="font-display text-base font-semibold text-marketing-navy">Bulk invoices</p>
      <p className="mt-1 text-xs text-marketing-navy/55">5,000+ sequential</p>
    </div>
  </div>
);
