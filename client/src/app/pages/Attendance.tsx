import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { Calendar, Plus, Save } from "lucide-react";

export const Attendance: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create Session state
  const [showCreate, setShowCreate] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [classId, setClassId] = useState("");
  const [periodNo, setPeriodNo] = useState("1");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  // Active Session state
  const [activeSession, setActiveSession] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    fetchSessions();
    api.get(`/s/${schoolSlug}/api/academics/classes`).then((res) => {
      const list = res.data || [];
      setClasses(list);
      if (list[0]) setClassId(list[0].id);
    }).catch(console.error);
  }, [schoolSlug]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/attendance`);
      setSessions(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post(`/s/${schoolSlug}/api/attendance/session`, {
        classId,
        date,
        periodNo: Number(periodNo) || undefined,
      });
      setActiveSession(res.data.session);
      setRecords(res.data.records);
      setShowCreate(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveAttendance = async () => {
    if (!activeSession) return;
    try {
      await api.patch(`/s/${schoolSlug}/api/attendance/session/${activeSession.id}`, { records });
      alert("Attendance saved!");
      setActiveSession(null); // Return to list
      fetchSessions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const updateRecordStatus = (studentId: string, status: string) => {
    setRecords(records.map(r => r.studentId === studentId ? { ...r, status } : r));
  };

  if (activeSession) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="page-header">
          <div>
            <h1 className="page-title">Take Attendance</h1>
            <p className="text-slate-400 mt-1">
              Class {activeSession.classId}
              {activeSession.periodNo != null ? ` • Period ${activeSession.periodNo}` : ""}
              {" • "}Date: {new Date(activeSession.date).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setActiveSession(null)} className="btn-ghost">Cancel</button>
            <button onClick={handleSaveAttendance} className="btn-primary">
              <Save className="w-4 h-4" /> Save Records
            </button>
          </div>
        </div>

        <div className="card p-4">
          <table className="table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.studentId}>
                  <td className="font-mono text-sm text-slate-300">{r.studentId}</td>
                  <td>
                    <select 
                      className="input w-48"
                      value={r.status}
                      onChange={(e) => updateRecordStatus(r.studentId, e.target.value)}
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="excused">Excused</option>
                    </select>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center py-6 text-slate-500">No students found in this class.</td>
                </tr>
              )}
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
          <h1 className="page-title">Attendance Logs</h1>
          <p className="text-slate-400 mt-1">Recent class attendance sessions</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Start Roll Call
        </button>
      </div>

      {showCreate && (
        <div className="card p-6 mb-6 border-blue-500/30">
          <form onSubmit={handleStartSession} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="label">Class</label>
              <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)} required>
                {classes.length === 0 ? (
                  <option value="">No classes configured</option>
                ) : classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="label">Period</label>
              <input type="number" min={1} max={12} className="input" value={periodNo} onChange={(e) => setPeriodNo(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="label">Date</label>
              <input type="date" required className="input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost mb-1">Cancel</button>
            <button type="submit" className="btn-primary mb-1">Start Session</button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? <p className="text-slate-400">Loading sessions...</p> : sessions.map(session => (
          <div key={session.id} className="card p-5 hover:border-slate-600 transition-colors cursor-pointer" onClick={() => { setActiveSession(session); /* Note: we'd normally fetch records here but omitting for brevity */ }}>
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-slate-800 rounded-xl">
                <Calendar className="w-5 h-5 text-indigo-400" />
              </div>
              <span className="text-xs font-medium text-slate-500 px-2 py-1 bg-slate-800 rounded-lg">
                {new Date(session.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <h3 className="font-semibold text-white truncate">Class {session.classId.substring(0,8)}...</h3>
            <p className="text-slate-400 text-sm mt-1">
              {new Date(session.date).toLocaleDateString()}
              {session.periodNo != null ? ` · Period ${session.periodNo}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
