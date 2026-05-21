import React from "react";
import { Link } from "react-router-dom";

export type WidgetData = {
  genderBreakdown: { male: number; female: number; other: number };
  feesChart: { collectedMinor: number; outstandingMinor: number; collectedByMonth: Array<{ month: string; amountMinor: number }> };
  expensesByMonth: Array<{ month: string; amountMinor: number }>;
  upcomingEvents: Array<{ id: string; title: string; at: string }>;
  recentAnnouncements: Array<{ id: string; title: string; createdAt: string }>;
};

function money(minor: number) {
  return `KES ${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function BarChart({ data, color }: { data: Array<{ label: string; value: number }>; color: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className={`w-full rounded-t-md ${color} transition-all`}
            style={{ height: `${Math.max(8, (d.value / max) * 100)}%` }}
            title={String(d.value)}
          />
          <span className="text-[10px] text-slate-500 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function Donut({ male, female, other }: { male: number; female: number; other: number }) {
  const total = male + female + other || 1;
  const pMale = (male / total) * 100;
  const pFemale = (female / total) * 100;
  const gradient = `conic-gradient(#3b82f6 0% ${pMale}%, #ec4899 ${pMale}% ${pMale + pFemale}%, #64748b ${pMale + pFemale}% 100%)`;
  return (
    <div className="flex items-center gap-6">
      <div className="h-28 w-28 rounded-full shrink-0" style={{ background: gradient }} />
      <ul className="text-sm space-y-2">
        <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" /> Male {male} ({Math.round(pMale)}%)</li>
        <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-pink-500" /> Female {female} ({Math.round(pFemale)}%)</li>
        <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-500" /> Other {other}</li>
      </ul>
    </div>
  );
}

export const DashboardCharts: React.FC<{ widgets: WidgetData; messagingPath: string }> = ({ widgets, messagingPath }) => {
  const feeBars = widgets.feesChart.collectedByMonth.slice(-6).map((m) => ({ label: m.month, value: m.amountMinor }));
  const expBars = widgets.expensesByMonth.slice(-6).map((m) => ({ label: m.month, value: m.amountMinor }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <h3 className="text-sm font-semibold text-white mb-4">Students by gender</h3>
          <Donut {...widgets.genderBreakdown} />
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-2">Fees collected (6 mo)</h3>
          <p className="text-xs text-slate-500 mb-3">
            Total collected {money(widgets.feesChart.collectedMinor)} · Outstanding {money(widgets.feesChart.outstandingMinor)}
          </p>
          {feeBars.length ? <BarChart data={feeBars} color="bg-violet-500" /> : <p className="text-sm text-slate-500">No payment data yet.</p>}
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Expenses (6 mo)</h3>
          {expBars.length ? <BarChart data={expBars} color="bg-amber-500" /> : <p className="text-sm text-slate-500">No expenses recorded.</p>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Upcoming events</h3>
          {widgets.upcomingEvents.length === 0 ? (
            <p className="text-sm text-slate-500">No scheduled announcements in the next 30 days.</p>
          ) : (
            <ul className="space-y-2">
              {widgets.upcomingEvents.map((e) => (
                <li key={e.id} className="flex justify-between gap-2 text-sm border-l-2 border-primary-600/50 pl-3 py-1">
                  <span className="text-slate-200">{e.title}</span>
                  <span className="text-xs text-slate-500 shrink-0">{new Date(e.at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Recent announcements</h3>
            <Link to={messagingPath} className="text-xs text-primary-400 hover:text-primary-300">View all →</Link>
          </div>
          {widgets.recentAnnouncements.length === 0 ? (
            <p className="text-sm text-slate-500">No published announcements.</p>
          ) : (
            <ul className="space-y-2">
              {widgets.recentAnnouncements.map((a) => (
                <li key={a.id} className="text-sm py-2 border-b border-slate-800 last:border-0">
                  <p className="text-slate-200">{a.title}</p>
                  <p className="text-xs text-slate-500">{new Date(a.createdAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
