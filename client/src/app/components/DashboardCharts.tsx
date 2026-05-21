import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";

export type WidgetData = {
  genderBreakdown: { male: number; female: number; other: number };
  feesChart: { collectedMinor: number; outstandingMinor: number; collectedByMonth: Array<{ month: string; amountMinor: number }> };
  expensesByMonth: Array<{ month: string; amountMinor: number }>;
  upcomingEvents: Array<{ id: string; title: string; at: string }>;
  recentAnnouncements: Array<{ id: string; title: string; createdAt: string }>;
};


function Panel({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="dash-panel">
      <div className="dash-panel-head">
        <h3 className="dash-panel-title">{title}</h3>
        {action ?? (
          <button type="button" className="dash-menu-btn" aria-label="Options">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function AreaFeesChart({ data, collected, outstanding, formatMoney }: {
  data: Array<{ label: string; value: number }>;
  collected: number;
  outstanding: number;
  formatMoney: (n: number) => string;
}) {
  const w = 520;
  const h = 160;
  const pad = { t: 12, r: 12, b: 28, l: 40 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const max = Math.max(...data.map((d) => d.value), 1);

  const points = data.map((d, i) => {
    const x = pad.l + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
    const y = pad.t + innerH - (d.value / max) * innerH;
    return { x, y, label: d.label };
  });

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = `${line} L ${points[points.length - 1]?.x ?? pad.l} ${pad.t + innerH} L ${points[0]?.x ?? pad.l} ${pad.t + innerH} Z`;

  return (
    <div>
      <div className="flex flex-wrap gap-6 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="dash-dot dash-dot-blue" />
          <span className="text-slate-600">Fees collected</span>
          <span className="font-semibold text-slate-900">{formatMoney(collected)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="dash-dot dash-dot-rose" />
          <span className="text-slate-600">Outstanding</span>
          <span className="font-semibold text-slate-900">{formatMoney(outstanding)}</span>
        </div>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">No payment history yet.</p>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Fees collected over time">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={pad.l}
              x2={w - pad.r}
              y1={pad.t + innerH * (1 - t)}
              y2={pad.t + innerH * (1 - t)}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          ))}
          <path d={area} fill="url(#feesGrad)" opacity="0.35" />
          <path d={line} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p) => (
            <text key={p.label} x={p.x} y={h - 6} textAnchor="middle" className="fill-slate-500 text-[9px]">
              {p.label}
            </text>
          ))}
          <defs>
            <linearGradient id="feesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      )}
    </div>
  );
}

function ExpensesBars({ data, formatMoney }: { data: Array<{ label: string; value: number; color: string }>; formatMoney: (n: number) => string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-4">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex justify-between text-xs text-slate-600 mb-1">
            <span>{d.label}</span>
            <span className="font-medium text-slate-800">{formatMoney(d.value)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${d.color}`} style={{ width: `${Math.max(4, (d.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
      {!data.length && <p className="text-sm text-slate-500">No expenses recorded.</p>}
    </div>
  );
}

function GenderDonut({ male, female, other }: { male: number; female: number; other: number }) {
  const total = male + female + other || 1;
  const pMale = Math.round((male / total) * 100);
  const pFemale = Math.round((female / total) * 100);
  const gradient = `conic-gradient(#3b82f6 0% ${pMale}%, #f59e0b ${pMale}% ${pMale + pFemale}%, #94a3b8 ${pMale + pFemale}% 100%)`;

  return (
    <div className="flex flex-col items-center gap-6 py-2 sm:flex-row sm:items-center sm:justify-center">
      <div className="relative h-40 w-40 shrink-0">
        <div className="absolute inset-0 rounded-full" style={{ background: gradient }} />
        <div className="absolute inset-[22%] rounded-full bg-white flex items-center justify-center">
          <span className="text-2xl font-bold text-slate-800">{male + female + other}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm w-full max-w-xs">
        <div>
          <div className="flex items-center gap-2 text-slate-600">
            <span className="dash-dot dash-dot-blue" /> Female
          </div>
          <p className="mt-1 text-lg font-semibold text-slate-900">{female.toLocaleString()}</p>
        </div>
        <div>
          <div className="flex items-center gap-2 text-slate-600">
            <span className="dash-dot dash-dot-amber" /> Male
          </div>
          <p className="mt-1 text-lg font-semibold text-slate-900">{male.toLocaleString()}</p>
        </div>
        {other > 0 && (
          <div className="col-span-2">
            <div className="flex items-center gap-2 text-slate-600">
              <span className="dash-dot bg-slate-400" /> Other {other}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniCalendar({ events }: { events: Array<{ at: string; title: string }> }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const eventDays = useMemo(() => {
    const set = new Set<number>();
    for (const e of events) {
      const d = new Date(e.at);
      if (d.getMonth() === month && d.getFullYear() === year) set.add(d.getDate());
    }
    return set;
  }, [events, month, year]);

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < startPad; i++) cells.push(<span key={`e-${i}`} className="dash-cal-day dash-cal-muted" />);
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === now.getDate();
    const hasEvent = eventDays.has(d);
    cells.push(
      <span
        key={d}
        className={`dash-cal-day ${isToday ? "dash-cal-today" : ""} ${hasEvent ? "dash-cal-event" : ""}`}
        title={hasEvent ? "Scheduled item" : undefined}
      >
        {d}
      </span>,
    );
  }

  return (
    <div>
      <p className="text-center text-sm font-semibold text-slate-800 mb-3">
        {now.toLocaleString(undefined, { month: "long", year: "numeric" })}
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-slate-500 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">{cells}</div>
      <ul className="mt-4 space-y-2 max-h-28 overflow-y-auto">
        {events.slice(0, 4).map((e, i) => (
          <li key={i} className="text-xs text-slate-600 flex justify-between gap-2 border-l-2 border-pink-400 pl-2">
            <span className="truncate text-slate-800">{e.title}</span>
            <span className="shrink-0">{new Date(e.at).toLocaleDateString()}</span>
          </li>
        ))}
        {!events.length && <li className="text-xs text-slate-500">No upcoming events.</li>}
      </ul>
    </div>
  );
}

export const DashboardCharts: React.FC<{
  widgets: WidgetData;
  messagingPath: string;
  formatMoney: (amountMinor: number | undefined | null) => string;
}> = ({ widgets, messagingPath, formatMoney }) => {
  const fmt = (n: number) => formatMoney(n);
  const feeBars = widgets.feesChart.collectedByMonth.slice(-6).map((m) => ({ label: m.month, value: m.amountMinor }));
  const expColors = ["bg-emerald-500", "bg-blue-500", "bg-amber-500", "bg-violet-500", "bg-rose-500", "bg-cyan-500"];
  const expBars = widgets.expensesByMonth.slice(-3).map((m, i) => ({
    label: m.month,
    value: m.amountMinor,
    color: expColors[i % expColors.length],
  }));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Fees collected" action={<span className="text-xs text-slate-500">Last 6 months</span>}>
            <AreaFeesChart
              data={feeBars}
              collected={widgets.feesChart.collectedMinor}
              outstanding={widgets.feesChart.outstandingMinor}
              formatMoney={fmt}
            />
          </Panel>
        </div>
        <Panel title="Expenses">
          <ExpensesBars data={expBars} formatMoney={fmt} />
        </Panel>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Panel title="Students">
          <GenderDonut {...widgets.genderBreakdown} />
        </Panel>
        <Panel title="Event calendar">
          <MiniCalendar events={widgets.upcomingEvents} />
        </Panel>
        <Panel
          title="Announcements"
          action={<Link to={messagingPath} className="text-xs font-medium text-blue-600 hover:underline">View all</Link>}
        >
          {widgets.recentAnnouncements.length === 0 ? (
            <p className="text-sm text-slate-500">No published announcements.</p>
          ) : (
            <ul className="space-y-3">
              {widgets.recentAnnouncements.map((a) => (
                <li key={a.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-slate-800">{a.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{new Date(a.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
};
