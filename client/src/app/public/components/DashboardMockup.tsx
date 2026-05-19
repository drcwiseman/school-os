import React from "react";
import { BarChart3, FileText, Users } from "lucide-react";

/** Layered dashboard preview for hero sections */
export const DashboardMockup: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`relative mx-auto w-full max-w-lg ${className}`}>
    <div className="glass-card animate-float overflow-hidden p-1 shadow-marketing-lg">
      <div className="rounded-xl bg-marketing-navy p-4 text-marketing-cream">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-marketing-sage">Exams · Term 2</span>
          <span className="rounded-full bg-marketing-burgundy/80 px-2 py-0.5 text-[10px]">Live</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Students", value: "1,248", icon: Users },
            { label: "Reports", value: "412", icon: FileText },
            { label: "Avg. score", value: "78%", icon: BarChart3 },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-white/10 p-2">
              <s.icon className="mb-1 h-3.5 w-3.5 text-marketing-sage" />
              <p className="text-lg font-semibold">{s.value}</p>
              <p className="text-[10px] text-marketing-cream/60">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {[92, 78, 65, 88].map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <span className="w-16 text-marketing-cream/50">Grade {10 - i}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-marketing-sage" style={{ width: `${w}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
    <div
      className="glass-card absolute -bottom-6 -left-8 w-44 animate-float p-3 shadow-marketing"
      style={{ animationDelay: "1.5s" }}
    >
      <p className="text-[10px] font-semibold uppercase text-marketing-sage">PDF Export</p>
      <p className="font-display text-sm text-marketing-navy">Report cards</p>
      <p className="mt-1 text-xs text-marketing-navy/60">412 generated · 12s</p>
    </div>
    <div
      className="glass-card absolute -right-6 top-8 w-40 animate-float p-3 shadow-marketing"
      style={{ animationDelay: "3s" }}
    >
      <p className="text-[10px] font-semibold uppercase text-marketing-burgundy">Finance</p>
      <p className="font-display text-sm text-marketing-navy">Invoices</p>
      <p className="mt-1 text-xs text-marketing-navy/60">5,000 sequential</p>
    </div>
  </div>
);
