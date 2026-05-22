import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, downloadPdf } from "../api/client";
import { Link } from "react-router-dom";
import { Loader2, Sparkles, BookOpen, Calendar, LogOut } from "lucide-react";
import { ParentPortalDashboard } from "./portal/parent/ParentPortalDashboard";

function formatMoney(cents: number | undefined, currency = "UGX") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(cents / 100);
}

export const PortalDashboard: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [payMsg] = useState(searchParams.get("paid") ? "Payment initiated — thank you!" : "");
  const [tutorMsg, setTutorMsg] = useState("");
  const [tutorReply, setTutorReply] = useState("");
  const [materials, setMaterials] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [onlineClasses, setOnlineClasses] = useState<any[]>([]);
  const [schoolEvents, setSchoolEvents] = useState<any[]>([]);

  const load = async () => {
    try {
      const me = await api.get(`/s/${schoolSlug}/api/portal/me`);
      setAccount(me.account);
      const [dash, sum] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/portal/dashboard`),
        api.get(`/s/${schoolSlug}/api/portal/dashboard/summary`).catch(() => ({ data: null })),
      ]);
      setData(dash.data);
      setSummary(sum.data);
    } catch {
      window.location.href = `/s/${schoolSlug}/portal/login`;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolSlug]);

  useEffect(() => {
    if (!schoolSlug || account?.type !== "student") return;
    Promise.all([
      api.get(`/s/${schoolSlug}/api/portal/student/materials`).catch(() => ({ data: [] })),
      api.get(`/s/${schoolSlug}/api/portal/student/timetable`).catch(() => ({ data: [] })),
      api.get(`/s/${schoolSlug}/api/portal/student/online-classes`).catch(() => ({ data: [] })),
      api.get(`/s/${schoolSlug}/api/portal/student/events`).catch(() => ({ data: [] })),
    ]).then(([m, t, o, ev]) => {
      setMaterials(m.data ?? []);
      setTimetable(t.data ?? []);
      setOnlineClasses(o.data ?? []);
      setSchoolEvents(ev.data ?? []);
    });
  }, [schoolSlug, account?.type]);

  const logout = async () => {
    await api.post(`/s/${schoolSlug}/api/portal/logout`, {});
    window.location.href = `/s/${schoolSlug}/portal/login`;
  };

  const downloadReportCard = async (id: string) => {
    await downloadPdf(`/s/${schoolSlug}/api/portal/pdf/report-card/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c1222]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (account?.type === "parent" && data) {
    return (
      <ParentPortalDashboard
        schoolSlug={schoolSlug!}
        account={account}
        data={data}
        summary={summary}
        onLogout={logout}
        payMsg={payMsg}
      />
    );
  }

  const currency = data?.currency ?? "UGX";

  return (
    <div className="min-h-screen bg-[#0c1222] text-slate-100">
      <header className="sticky top-0 z-10 border-b border-white/5 bg-[#0c1222]/90 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-teal-400 font-semibold">Student portal</p>
            <h1 className="text-lg font-bold capitalize">{schoolSlug?.replace(/-/g, " ")}</h1>
          </div>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs" onClick={logout}>
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5 pb-12">
        {account?.type === "student" && data && (
          <>
            <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-slate-900/80 to-slate-950 p-4">
              <p className="text-white font-semibold text-lg">{data.student?.firstName} {data.student?.lastName}</p>
              <p className="text-slate-500 text-sm font-mono">{data.student?.admissionNumber}</p>
            </div>

            {summary && (
              <div className="grid grid-cols-2 gap-3">
                <StudentStat label="Fees due" value={formatMoney(summary.feeDueMinor, currency)} highlight={summary.feeDueMinor > 0} />
                <StudentStat label="Present days" value={String(summary.attendancePresent ?? 0)} />
                <StudentStat label="Homework done" value={String(summary.submissionsCount ?? 0)} />
                <StudentStat label="Pending leave" value={String(summary.pendingLeaves ?? 0)} />
              </div>
            )}

            {data.reportCard && (
              <PortalCard title="Report card">
                <button type="button" className="text-teal-400 text-sm" onClick={() => downloadReportCard(data.reportCard.id)}>Download PDF</button>
              </PortalCard>
            )}

            <PortalCard title="Homework">
              <HomeworkPortalList schoolSlug={schoolSlug!} assignments={data.assignments ?? []} submissions={data.submissions ?? []} />
            </PortalCard>

            <PortalCard title="Attendance">
              <AttendanceList rows={data.attendance ?? []} />
            </PortalCard>

            <PortalCard title="Noticeboard">
              <ul className="text-slate-300 text-sm space-y-3">
                {(data.noticeboard ?? []).map((a: any) => (
                  <li key={a.id}><strong className="text-white block">{a.title}</strong><span className="text-slate-500 text-xs block">{a.body?.slice(0, 200)}</span></li>
                ))}
                {!(data.noticeboard ?? []).length && <p className="text-slate-500 text-sm">No announcements.</p>}
              </ul>
            </PortalCard>

            <StudentLeavePortal schoolSlug={schoolSlug!} leaves={data.leaves ?? []} studentId={data.student?.id} onRefresh={() => window.location.reload()} />

            <PortalCard title="CBT exams" icon={BookOpen}>
              <Link to={`/s/${schoolSlug}/exam`} className="rounded-lg bg-teal-600 text-white text-sm px-4 py-2 inline-block">Open exam player</Link>
            </PortalCard>

            <PortalCard title="Timetable" icon={Calendar}>
              <ul className="text-slate-300 text-sm space-y-1">
                {timetable.slice(0, 12).map((p: any) => (
                  <li key={p.id}>Period {p.periodNo ?? "—"} · {p.dayOfWeek ?? ""}</li>
                ))}
                {timetable.length === 0 && <p className="text-slate-500">No timetable published.</p>}
              </ul>
            </PortalCard>

            <PortalCard title="Study materials">
              <ul className="text-slate-300 text-sm space-y-1">
                {materials.map((m: any) => (
                  <li key={m.id}>
                    {m.title}
                    {m.filePath ? <> — <a href={`/s/${schoolSlug}/api/portal/student/materials/${m.id}/file`} className="text-teal-400" target="_blank" rel="noreferrer">download</a></> : null}
                  </li>
                ))}
              </ul>
            </PortalCard>

            <PortalCard title="Online classes">
              <ul className="text-slate-300 text-sm space-y-2">
                {onlineClasses.map((c: any) => (
                  <li key={c.id}>
                    <a href={c.url} className="text-teal-400" target="_blank" rel="noreferrer">{c.title}</a>
                  </li>
                ))}
              </ul>
            </PortalCard>

            <PortalCard title="School events" icon={Calendar}>
              <ul className="text-slate-300 text-sm space-y-1">
                {schoolEvents.map((e: any) => (
                  <li key={e.id}><strong className="text-white">{e.title}</strong><span className="text-slate-500 block text-xs">{new Date(e.startsAt).toLocaleString()}</span></li>
                ))}
              </ul>
            </PortalCard>

            <PortalCard title="AI tutor" icon={Sparkles}>
              <textarea className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm min-h-[80px]" value={tutorMsg} onChange={(e) => setTutorMsg(e.target.value)} placeholder="Ask a study question…" />
              <button type="button" className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-sm" onClick={async () => {
                const res = await api.post(`/s/${schoolSlug}/api/portal/student/tutor`, { message: tutorMsg, subject: "General" });
                setTutorReply(res.data?.reply ?? "");
              }}>Ask</button>
              {tutorReply && <p className="text-slate-300 text-sm mt-2">{tutorReply}</p>}
            </PortalCard>
          </>
        )}
      </main>
    </div>
  );
};

function PortalCard({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/40 p-5">
      <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-teal-400" />}
        {title}
      </h2>
      {children}
    </div>
  );
}

function StudentStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "border-amber-500/30" : "border-white/8"}`}>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className={`text-lg font-bold ${highlight ? "text-amber-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

function HomeworkPortalList({ schoolSlug, assignments, submissions }: { schoolSlug: string; assignments: any[]; submissions: any[] }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const subByAssignment = Object.fromEntries(submissions.map((s: any) => [s.assignmentId, s]));
  const submit = async (assignmentId: string) => {
    const content = drafts[assignmentId]?.trim();
    if (!content) return;
    await api.post(`/s/${schoolSlug}/api/portal/student/assignments/${assignmentId}/submit`, { content });
    window.location.reload();
  };
  if (!assignments.length) return <p className="text-slate-500 text-sm">No homework assigned.</p>;
  return (
    <ul className="text-slate-300 text-sm space-y-3">
      {assignments.map((a: any) => {
        const sub = subByAssignment[a.id];
        return (
          <li key={a.id} className="border-b border-white/5 pb-2">
            <p className="text-white font-medium">{a.title}</p>
            {sub ? <p className="text-xs text-emerald-400 mt-1">Submitted · {sub.status}</p> : (
              <div className="mt-2 space-y-1">
                <textarea className="w-full rounded-lg bg-slate-900 border border-white/10 text-sm min-h-[60px] px-3 py-2" value={drafts[a.id] ?? ""} onChange={(e) => setDrafts({ ...drafts, [a.id]: e.target.value })} />
                <button type="button" className="rounded-lg bg-teal-600 text-white text-xs px-3 py-1" onClick={() => submit(a.id)}>Submit</button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function StudentLeavePortal({ schoolSlug, leaves: initialLeaves, studentId, onRefresh }: { schoolSlug: string; leaves?: any[]; studentId?: string; onRefresh: () => void }) {
  const [form, setForm] = useState({ startDate: "", endDate: "", reason: "" });
  const [leaves, setLeaves] = useState<any[]>(initialLeaves ?? []);
  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/portal/leaves`).then((r) => {
      const all = r.data ?? [];
      setLeaves(studentId ? all.filter((l: any) => l.studentId === studentId) : all);
    }).catch(() => {});
  }, [schoolSlug, studentId]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/portal/leaves`, { ...form, studentId });
    setForm({ startDate: "", endDate: "", reason: "" });
    onRefresh();
  };
  return (
    <PortalCard title="Leave requests">
      <form onSubmit={submit} className="space-y-2 mb-4">
        <input type="date" className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        <input type="date" className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        <input className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm" required placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        <button type="submit" className="rounded-lg bg-teal-600 text-white text-xs px-3 py-2">Submit</button>
      </form>
      <ul className="text-slate-300 text-sm space-y-1">
        {leaves.map((l: any) => (
          <li key={l.id}>{new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()} · {l.status}</li>
        ))}
      </ul>
    </PortalCard>
  );
}

function AttendanceList({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <p className="text-slate-400 text-sm">No records yet.</p>;
  return (
    <ul className="text-slate-300 text-sm space-y-1">
      {rows.map((r, i) => (
        <li key={i}>{r.date ? new Date(r.date).toLocaleDateString() : "—"} — <span className="capitalize">{r.status}</span></li>
      ))}
    </ul>
  );
}
