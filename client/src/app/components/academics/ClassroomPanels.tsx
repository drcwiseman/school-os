import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useToast } from "../Toast";

export const TeacherAssignPanel: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [form, setForm] = useState({ userId: "", classId: "", subjectId: "", role: "subject" });

  useEffect(() => {
    if (!schoolSlug) return;
    Promise.all([
      api.get(`/s/${schoolSlug}/api/academics/teacher-assignments`),
      api.get(`/s/${schoolSlug}/api/admin/users`),
      api.get(`/s/${schoolSlug}/api/academics/classes`),
      api.get(`/s/${schoolSlug}/api/academics/subjects`),
    ]).then(([a, u, c, s]) => {
      setRows(a.data ?? []);
      setUsers(u.data ?? []);
      setClasses(c.data ?? []);
      setSubjects(s.data ?? []);
    });
  }, [schoolSlug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/academics/teacher-assignments`, form);
    toast("Assigned", "success");
    const a = await api.get(`/s/${schoolSlug}/api/academics/teacher-assignments`);
    setRows(a.data ?? []);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <form onSubmit={submit} className="card p-5 space-y-3">
        <h3 className="font-semibold text-white">Class & subject teachers</h3>
        <select className="input" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
          <option value="">Teacher…</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
        </select>
        <select className="input" value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} required>
          <option value="">Class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="subject">Subject teacher</option>
          <option value="class_teacher">Class teacher</option>
        </select>
        {form.role === "subject" && (
          <select className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} required>
            <option value="">Subject…</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <button type="submit" className="btn-primary">Assign</button>
      </form>
      <div className="card p-5 text-sm text-slate-300 space-y-1">
        {rows.map((r) => <p key={r.id}>{r.teacherName} — {r.className} {r.subjectName ? `· ${r.subjectName}` : `· ${r.role}`}</p>)}
      </div>
    </div>
  );
};

export const RosterPanel: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [streamId, setStreamId] = useState("");
  const [streams, setStreams] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/academics/classes`).then(async (c) => {
      const all: any[] = [];
      for (const cls of c.data ?? []) {
        const s = await api.get(`/s/${schoolSlug}/api/academics/classes/${cls.id}/streams`);
        for (const st of s.data ?? []) all.push({ ...st, className: cls.name });
      }
      setStreams(all);
    });
  }, [schoolSlug]);

  useEffect(() => {
    if (!streamId) return;
    api.get(`/s/${schoolSlug}/api/academics/streams/${streamId}/roster`).then((r) => setRoster(r.data?.roster ?? []));
  }, [streamId, schoolSlug]);

  return (
    <div className="card p-5 space-y-3">
      <h3 className="font-semibold text-white">Class roster</h3>
      <select className="input" value={streamId} onChange={(e) => setStreamId(e.target.value)}>
        <option value="">Stream…</option>
        {streams.map((s) => <option key={s.id} value={s.id}>{s.className} — {s.name}</option>)}
      </select>
      <ul className="text-sm text-slate-300">{roster.map((s) => <li key={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</li>)}</ul>
    </div>
  );
};

export const TimetableBuilderPanel: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [timetables, setTimetables] = useState<any[]>([]);
  const [selected, setSelected] = useState("");
  const [periods, setPeriods] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [periodForm, setPeriodForm] = useState({ dayOfWeek: "1", periodNo: "1", subjectId: "", teacherUserId: "", roomId: "" });

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/academics/timetables`).then((r) => setTimetables(r.data ?? []));
  }, [schoolSlug]);

  const loadPeriods = async (id: string) => {
    setSelected(id);
    const p = await api.get(`/s/${schoolSlug}/api/academics/timetables/${id}/periods`);
    setPeriods(p.data ?? []);
    const c = await api.get(`/s/${schoolSlug}/api/academics/timetables/${id}/conflicts`);
    setConflicts(c.data?.conflicts ?? []);
  };

  const addPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/academics/timetables/${selected}/periods`, {
      dayOfWeek: Number(periodForm.dayOfWeek),
      periodNo: Number(periodForm.periodNo),
      subjectId: periodForm.subjectId || undefined,
      teacherUserId: periodForm.teacherUserId || undefined,
      roomId: periodForm.roomId || undefined,
    });
    toast("Period added", "success");
    loadPeriods(selected);
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="card p-5 space-y-3">
        <h3 className="font-semibold text-white">Timetable builder</h3>
        <select className="input" value={selected} onChange={(e) => e.target.value && loadPeriods(e.target.value)}>
          <option value="">Select timetable…</option>
          {timetables.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {selected && (
          <form onSubmit={addPeriod} className="space-y-2">
            <input className="input" placeholder="Day 0-6" value={periodForm.dayOfWeek} onChange={(e) => setPeriodForm({ ...periodForm, dayOfWeek: e.target.value })} />
            <input className="input" placeholder="Period #" value={periodForm.periodNo} onChange={(e) => setPeriodForm({ ...periodForm, periodNo: e.target.value })} />
            <button type="submit" className="btn-primary">Add period</button>
          </form>
        )}
        {conflicts.length > 0 && <p className="text-amber-400 text-sm">{conflicts.length} conflict(s) detected</p>}
      </div>
      <div className="card p-5 text-sm text-slate-300">
        {periods.map((p) => <p key={p.id}>Day {p.dayOfWeek} P{p.periodNo}</p>)}
      </div>
    </div>
  );
};

export const LessonLogPanel: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [filterClass, setFilterClass] = useState("");
  const [form, setForm] = useState({ classId: "", subjectId: "", topic: "", notes: "", progressPercent: "0" });

  const load = () => {
    api.get(`/s/${schoolSlug}/api/academics/lesson-logs`).then((r) => setLogs(r.data ?? []));
    const q = filterClass ? `?classId=${filterClass}` : "";
    api.get(`/s/${schoolSlug}/api/academics/lesson-logs/progress${q}`).then((r) => setProgress(r.data ?? []));
  };

  useEffect(() => {
    Promise.all([
      api.get(`/s/${schoolSlug}/api/academics/classes`),
      api.get(`/s/${schoolSlug}/api/academics/subjects`),
    ]).then(([c, s]) => {
      setClasses(c.data ?? []);
      setSubjects(s.data ?? []);
    });
    load();
  }, [schoolSlug, filterClass]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/academics/lesson-logs`, {
      ...form,
      progressPercent: Number(form.progressPercent) || 0,
      subjectId: form.subjectId || undefined,
    });
    toast("Logged", "success");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={submit} className="card p-5 space-y-3">
          <h3 className="font-semibold text-white">Lesson tracking</h3>
          <select className="input" required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
            <option value="">Class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
            <option value="">Subject…</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input className="input" placeholder="Topic" required value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
          <textarea className="input" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div>
            <label className="label">Progress % for this subject</label>
            <input className="input" type="number" min={0} max={100} value={form.progressPercent} onChange={(e) => setForm({ ...form, progressPercent: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary">Log lesson</button>
        </form>
        <div className="card p-5">
          <h3 className="font-semibold text-white mb-3">Progress by subject</h3>
          <select className="input mb-3" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ul className="space-y-2 text-sm">
            {progress.map((p, i) => (
              <li key={i} className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-300">{p.subjectName ?? "General"} · {p.topicCount} lessons</span>
                <span className="text-primary-300 font-medium">{p.avgProgress}%</span>
              </li>
            ))}
            {!progress.length && <p className="text-slate-500">No lesson data yet.</p>}
          </ul>
        </div>
      </div>
      <div className="card p-5 text-sm text-slate-300 space-y-1 max-h-48 overflow-y-auto">
        <h4 className="text-white font-medium mb-2">Recent logs</h4>
        {logs.map((l) => <p key={l.id}>{l.topic} — {l.progressPercent ?? 0}%</p>)}
      </div>
    </div>
  );
};

export const SeatingPanel: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [streamId, setStreamId] = useState("");
  const [streams, setStreams] = useState<any[]>([]);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(4);

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/academics/classes`).then(async (c) => {
      const all: any[] = [];
      for (const cls of c.data ?? []) {
        const s = await api.get(`/s/${schoolSlug}/api/academics/classes/${cls.id}/streams`);
        for (const st of s.data ?? []) all.push({ ...st, className: cls.name });
      }
      setStreams(all);
    });
  }, [schoolSlug]);

  const save = async () => {
    const seats = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) seats.push({ row: r, col: c });
    await api.put(`/s/${schoolSlug}/api/academics/streams/${streamId}/seating`, { rows, cols, seatsJson: seats });
    toast("Seating grid saved", "success");
  };

  return (
    <div className="card p-5 space-y-3">
      <h3 className="font-semibold text-white">Seating arrangement</h3>
      <select className="input" value={streamId} onChange={(e) => setStreamId(e.target.value)}>
        <option value="">Stream…</option>
        {streams.map((s) => <option key={s.id} value={s.id}>{s.className} — {s.name}</option>)}
      </select>
      <div className="flex gap-2">
        <input className="input" type="number" value={rows} onChange={(e) => setRows(Number(e.target.value))} />
        <input className="input" type="number" value={cols} onChange={(e) => setCols(Number(e.target.value))} />
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: rows * cols }).map((_, i) => (
          <div key={i} className="h-8 bg-slate-800 rounded text-xs flex items-center justify-center text-slate-500">{i + 1}</div>
        ))}
      </div>
      <button type="button" className="btn-primary" disabled={!streamId} onClick={save}>Save layout</button>
    </div>
  );
};

export const SmartDevicesPanel: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [devices, setDevices] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", deviceType: "smartboard", serialNo: "" });

  const load = () => api.get(`/s/${schoolSlug}/api/academics/smart-devices`).then((r) => setDevices(r.data ?? []));
  useEffect(() => { load(); }, [schoolSlug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/academics/smart-devices`, form);
    toast("Device registered", "success");
    load();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <form onSubmit={submit} className="card p-5 space-y-3">
        <h3 className="font-semibold text-white">Smart boards & devices</h3>
        <input className="input" placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input" placeholder="Serial" value={form.serialNo} onChange={(e) => setForm({ ...form, serialNo: e.target.value })} />
        <button type="submit" className="btn-primary">Register</button>
      </form>
      <div className="card p-5 text-sm text-slate-300">{devices.map((d) => <p key={d.id}>{d.name} — {d.deviceType}</p>)}</div>
    </div>
  );
};
