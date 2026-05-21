import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Calendar, Plus, Save, Bell, BarChart3 } from "lucide-react";

type RecordRow = {
  studentId: string;
  status: string;
  note?: string;
  firstName?: string;
  lastName?: string;
  admissionNumber?: string;
};

export const Attendance: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [tab, setTab] = useState<"take" | "sessions" | "reports">("take");
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState("");
  const [periodNo, setPeriodNo] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [notifyChannels, setNotifyChannels] = useState<string[]>(["sms"]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/attendance/sessions/enriched`);
      setSessions(res.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast]);

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/academics/classes`).then((r) => {
      const list = r.data ?? [];
      setClasses(list);
      if (list[0]) setClassId(list[0].id);
    }).catch(() => {});
  }, [schoolSlug]);

  useEffect(() => {
    if (tab === "sessions") loadSessions();
    if (tab === "reports") {
      api.get(`/s/${schoolSlug}/api/attendance/reports/daily?date=${reportDate}${classId ? `&classId=${classId}` : ""}`)
        .then((r) => setDailyReport(r.data))
        .catch(() => {});
    }
  }, [tab, schoolSlug, reportDate, classId, loadSessions]);

  const openSession = async (sessionId: string) => {
    const res = await api.get(`/s/${schoolSlug}/api/attendance/session/${sessionId}/detail`);
    const d = res.data;
    setActiveSession({ ...d.session, className: d.className });
    setRecords((d.records ?? []).map((r: any) => ({
      studentId: r.record.studentId,
      status: r.record.status,
      note: r.record.note ?? "",
      firstName: r.firstName,
      lastName: r.lastName,
      admissionNumber: r.admissionNumber,
    })));
    setTab("take");
  };

  const startSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post(`/s/${schoolSlug}/api/attendance/session`, { classId, date, periodNo: Number(periodNo) || undefined });
      const roster = res.data?.records ?? [];
      setActiveSession(res.data?.session);
      setRecords(roster.map((r: any) => ({
        studentId: r.studentId,
        status: r.status ?? "present",
        note: r.note ?? "",
      })));
      if (!roster.length) {
        const detail = await api.get(`/s/${schoolSlug}/api/attendance/session/${res.data.session.id}/detail`);
        setRecords((detail.data?.records ?? []).map((r: any) => ({
          studentId: r.record.studentId,
          status: r.record.status,
          note: r.record.note ?? "",
          firstName: r.firstName,
          lastName: r.lastName,
          admissionNumber: r.admissionNumber,
        })));
        setActiveSession({ ...res.data.session, className: detail.data?.className });
      }
      toast("Attendance session started", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const saveAttendance = async () => {
    if (!activeSession) return;
    try {
      await api.patch(`/s/${schoolSlug}/api/attendance/session/${activeSession.id}`, {
        records: records.map((r) => ({ studentId: r.studentId, status: r.status, note: r.note || undefined })),
      });
      toast("Attendance saved", "success");
      setActiveSession(null);
      loadSessions();
      setTab("sessions");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const notifyAbsences = async () => {
    if (!activeSession) return;
    try {
      const res = await api.post(`/s/${schoolSlug}/api/attendance/session/${activeSession.id}/notify-absences`, {
        channels: notifyChannels,
      });
      toast(`Alerts sent: ${res.data?.sent ?? 0}`, "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  const tabBtn = (t: typeof tab) =>
    `px-4 py-2 rounded-lg text-sm capitalize ${tab === t ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`;

  if (tab === "take" && activeSession) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Take attendance</h1>
            <p className="text-slate-400 mt-1">
              {activeSession.className ?? "Class"} · {new Date(activeSession.date).toLocaleDateString()}
              {activeSession.periodNo != null ? ` · Period ${activeSession.periodNo}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setActiveSession(null)} className="btn-ghost">Back</button>
            <button type="button" onClick={notifyAbsences} className="btn-ghost"><Bell className="w-4 h-4" /> Notify parents</button>
            <button type="button" onClick={saveAttendance} className="btn-primary"><Save className="w-4 h-4" /> Save</button>
          </div>
        </div>
        <div className="card p-3 flex gap-3 text-sm">
          <label className="flex items-center gap-2 text-slate-300"><input type="checkbox" checked={notifyChannels.includes("sms")} onChange={(e) => setNotifyChannels(e.target.checked ? [...notifyChannels, "sms"] : notifyChannels.filter((c) => c !== "sms"))} /> SMS</label>
          <label className="flex items-center gap-2 text-slate-300"><input type="checkbox" checked={notifyChannels.includes("email")} onChange={(e) => setNotifyChannels(e.target.checked ? [...notifyChannels, "email"] : notifyChannels.filter((c) => c !== "email"))} /> Email</label>
        </div>
        <div className="card p-4 overflow-x-auto">
          <table className="table">
            <thead><tr><th>Student</th><th>Adm. no.</th><th>Status</th><th>Note</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.studentId}>
                  <td className="text-white">{r.firstName} {r.lastName}</td>
                  <td className="text-slate-400 text-sm">{r.admissionNumber ?? "—"}</td>
                  <td>
                    <select className="input w-36" value={r.status} onChange={(e) => setRecords(records.map((x) => x.studentId === r.studentId ? { ...x, status: e.target.value } : x))}>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="excused">Excused</option>
                    </select>
                  </td>
                  <td><input className="input text-sm" value={r.note ?? ""} onChange={(e) => setRecords(records.map((x) => x.studentId === r.studentId ? { ...x, note: e.target.value } : x))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="text-slate-400 mt-1">Digital roll call, reports, and parent alerts</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" className={tabBtn("take")} onClick={() => setTab("take")}>Take attendance</button>
        <button type="button" className={tabBtn("sessions")} onClick={() => setTab("sessions")}>Sessions</button>
        <button type="button" className={tabBtn("reports")} onClick={() => setTab("reports")}>Reports</button>
      </div>

      {tab === "take" && (
        <form onSubmit={startSession} className="card p-6 grid md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="label">Class</label>
            <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)} required>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Period</label>
            <input type="number" min={1} max={12} className="input" value={periodNo} onChange={(e) => setPeriodNo(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary"><Plus className="w-4 h-4" /> Start roll call</button>
        </form>
      )}

      {tab === "sessions" && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? <p className="text-slate-400">Loading…</p> : sessions.map((row: any) => (
            <button key={row.session.id} type="button" className="card p-5 text-left hover:border-primary-600/50" onClick={() => openSession(row.session.id)}>
              <Calendar className="w-5 h-5 text-indigo-400 mb-2" />
              <h3 className="font-semibold text-white">{row.className}</h3>
              <p className="text-slate-400 text-sm">{new Date(row.session.date).toLocaleDateString()}</p>
              <p className="text-slate-500 text-xs mt-2">{row.recordCount} students · {row.absentCount} absent</p>
            </button>
          ))}
        </div>
      )}

      {tab === "reports" && (
        <div className="space-y-4">
          <div className="card p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Class (optional)</label>
              <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">All classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          {dailyReport && (
            <div className="grid sm:grid-cols-4 gap-4">
              {(["present", "absent", "late", "excused"] as const).map((k) => (
                <div key={k} className="card p-4">
                  <p className="text-slate-500 text-sm capitalize flex items-center gap-1"><BarChart3 className="w-4 h-4" />{k}</p>
                  <p className="text-2xl font-bold text-white">{dailyReport[k] ?? 0}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
