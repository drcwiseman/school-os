import React, { useCallback, useEffect, useState } from "react";
import { api, downloadPdf } from "../../api/client";
import { useToast } from "../Toast";

type ClassRow = { id: string; name: string };
type TermRow = { id: string; name: string };
type SubjectRow = { id: string; name: string; code?: string };

function useExamMeta(schoolSlug: string) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  useEffect(() => {
    if (!schoolSlug) return;
    Promise.all([
      api.get(`/s/${schoolSlug}/api/academics/classes`),
      api.get(`/s/${schoolSlug}/api/academics/terms`),
      api.get(`/s/${schoolSlug}/api/academics/subjects`),
      api.get(`/s/${schoolSlug}/api/exams/groups`),
    ]).then(([c, t, s, g]) => {
      setClasses(c.data ?? []);
      setTerms(t.data ?? []);
      setSubjects(s.data ?? []);
      setGroups(g.data ?? []);
    }).catch(() => {});
  }, [schoolSlug]);
  return { classes, terms, subjects, groups, reloadGroups: () => api.get(`/s/${schoolSlug}/api/exams/groups`).then((r) => setGroups(r.data ?? [])) };
}

export const ExamGroupsPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { terms, groups, reloadGroups } = useExamMeta(schoolSlug);
  const [form, setForm] = useState({ name: "", groupType: "term", termId: "", description: "" });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/exams/groups`, { ...form, termId: form.termId || undefined });
    toast("Exam group created", "success");
    setForm({ name: "", groupType: "term", termId: "", description: "" });
    reloadGroups();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="card p-4 grid md:grid-cols-4 gap-3">
        <input className="input" placeholder="Group name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select className="input" value={form.groupType} onChange={(e) => setForm({ ...form, groupType: e.target.value })}>
          <option value="term">Term</option>
          <option value="unit">Unit</option>
          <option value="custom">Custom</option>
        </select>
        <select className="input" value={form.termId} onChange={(e) => setForm({ ...form, termId: e.target.value })}>
          <option value="">Link term (optional)</option>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button type="submit" className="btn-primary">Add group</button>
      </form>
      <ul className="space-y-2">
        {groups.map((g: any) => (
          <li key={g.id} className="card p-4 flex justify-between items-center">
            <div>
              <p className="text-white font-medium">{g.name}</p>
              <p className="text-slate-500 text-sm capitalize">{g.groupType}{g.published ? " · Published" : ""}</p>
            </div>
            {!g.published && (
              <button type="button" className="btn-ghost text-xs" onClick={async () => {
                await api.patch(`/s/${schoolSlug}/api/exams/groups/${g.id}`, { published: true });
                reloadGroups();
              }}>Publish</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ExamTimetablePanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { classes, subjects, groups } = useExamMeta(schoolSlug);
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ examGroupId: "", classId: "", subjectId: "", examDate: "", startTime: "09:00", endTime: "11:00", room: "" });

  const load = useCallback(() => {
    const q = form.examGroupId ? `?examGroupId=${form.examGroupId}` : "";
    api.get(`/s/${schoolSlug}/api/exams/timetable${q}`).then((r) => setRows(r.data ?? [])).catch(() => {});
  }, [schoolSlug, form.examGroupId]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post(`/s/${schoolSlug}/api/exams/timetable`, { ...form, examGroupId: form.examGroupId || undefined });
    toast("Timetable slot added", "success");
    load();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="card p-4 grid md:grid-cols-3 gap-3">
        <select className="input" value={form.examGroupId} onChange={(e) => setForm({ ...form, examGroupId: e.target.value })}>
          <option value="">Exam group</option>
          {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="input" required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
          <option value="">Class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" required value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
          <option value="">Subject</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" className="input" required value={form.examDate} onChange={(e) => setForm({ ...form, examDate: e.target.value })} />
        <input className="input" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        <input className="input" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
        <input className="input" placeholder="Room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
        <button type="submit" className="btn-primary md:col-span-3">Add slot</button>
      </form>
      <ul className="space-y-2">
        {rows.map((r: any) => (
          <li key={r.slot.id} className="card p-3 text-sm text-slate-300">
            <span className="text-white font-medium">{r.className} · {r.subjectName}</span>
            {" — "}{new Date(r.slot.examDate).toLocaleDateString()} {r.slot.startTime}–{r.slot.endTime}
            {r.slot.room ? ` · ${r.slot.room}` : ""}
            {r.slot.published ? " · Published" : (
              <button type="button" className="btn-ghost text-xs ml-2" onClick={async () => {
                await api.patch(`/s/${schoolSlug}/api/exams/timetable/${r.slot.id}/publish`, {});
                load();
              }}>Publish</button>
            )}
            <button type="button" className="btn-ghost text-xs ml-2 text-red-400" onClick={async () => {
              if (!confirm("Delete this slot?")) return;
              await api.delete(`/s/${schoolSlug}/api/exams/timetable/${r.slot.id}`);
              toast("Slot deleted", "success");
              load();
            }}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const ExamResultsPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { classes, groups } = useExamMeta(schoolSlug);
  const [compute, setCompute] = useState({ examGroupId: "", classId: "" });

  const runCompute = async () => {
    await api.post(`/s/${schoolSlug}/api/exams/results/compute`, compute);
    toast("Grades computed", "success");
  };

  const runPublish = async () => {
    await api.post(`/s/${schoolSlug}/api/exams/results/publish`, compute);
    toast("Results published", "success");
  };

  return (
    <div className="card p-4 space-y-4 max-w-xl">
      <p className="text-slate-400 text-sm">Compute letter grades and remarks from scores, then publish to the student portal.</p>
      <select className="input" value={compute.examGroupId} onChange={(e) => setCompute({ ...compute, examGroupId: e.target.value })}>
        <option value="">Exam group (optional)</option>
        {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      <select className="input" value={compute.classId} onChange={(e) => setCompute({ ...compute, classId: e.target.value })}>
        <option value="">Class (optional)</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={runCompute}>Compute grades</button>
        <button type="button" className="btn-secondary" onClick={runPublish}>Publish results</button>
      </div>
    </div>
  );
};

export const ExamPrintingPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { classes, terms, groups } = useExamMeta(schoolSlug);
  const [academicGroups, setAcademicGroups] = useState<any[]>([]);
  const [print, setPrint] = useState({
    examGroupId: "", classId: "", termId: "", assessmentId: "", hall: "Main Hall", academicGroupId: "",
  });
  const [assessments, setAssessments] = useState<any[]>([]);

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/exams/assessments`).then((r) => setAssessments(r.data ?? [])).catch(() => {});
    api.get(`/s/${schoolSlug}/api/exams/academic-groups`).then((r) => setAcademicGroups(Array.isArray(r.data) ? r.data : [])).catch(() => []);
  }, [schoolSlug]);

  const issueAdmits = async () => {
    if (!print.examGroupId || !print.classId) return toast("Select exam group and class", "error");
    const res = await api.post(`/s/${schoolSlug}/api/exams/admit-cards/issue`, {
      examGroupId: print.examGroupId, classId: print.classId, hall: print.hall,
    });
    toast(`Issued ${res.data?.issued ?? 0} admit cards`, "success");
  };

  return (
    <div className="card p-4 space-y-6 max-w-2xl">
      <section className="space-y-3">
        <h3 className="text-white font-medium">Admit cards</h3>
        <select className="input" value={print.examGroupId} onChange={(e) => setPrint({ ...print, examGroupId: e.target.value })}>
          <option value="">Exam group</option>
          {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="input" value={print.classId} onChange={(e) => setPrint({ ...print, classId: e.target.value })}>
          <option value="">Class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="input" placeholder="Hall" value={print.hall} onChange={(e) => setPrint({ ...print, hall: e.target.value })} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary text-sm" onClick={issueAdmits}>Issue all admit cards</button>
          <button type="button" className="btn-ghost text-sm" disabled={!print.examGroupId} onClick={() => downloadPdf(`/s/${schoolSlug}/api/exams/pdf/admit-cards/bulk?examGroupId=${print.examGroupId}&classId=${print.classId}`)}>
            Bulk print admit cards
          </button>
        </div>
      </section>
      <section className="space-y-3">
        <h3 className="text-white font-medium">Result & mark sheets</h3>
        <select className="input" value={print.assessmentId} onChange={(e) => setPrint({ ...print, assessmentId: e.target.value })}>
          <option value="">Assessment for mark sheet</option>
          {assessments.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button type="button" className="btn-ghost text-sm" disabled={!print.assessmentId} onClick={() => downloadPdf(`/s/${schoolSlug}/api/exams/pdf/marksheet/${print.assessmentId}`)}>
          Print mark sheet
        </button>
        <select className="input" value={print.termId} onChange={(e) => setPrint({ ...print, termId: e.target.value })}>
          <option value="">Term</option>
          {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="input" value={print.academicGroupId} onChange={(e) => setPrint({ ...print, academicGroupId: e.target.value })}>
          <option value="">Academic group (optional)</option>
          {academicGroups.map((g: any) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
        <button type="button" className="btn-ghost text-sm" disabled={!print.termId || !print.classId} onClick={() => {
          const q = `termId=${print.termId}&classId=${print.classId}${print.examGroupId ? `&examGroupId=${print.examGroupId}` : ""}${print.academicGroupId ? `&academicGroupId=${print.academicGroupId}` : ""}`;
          downloadPdf(`/s/${schoolSlug}/api/exams/pdf/results/bulk?${q}`);
        }}>Bulk print result sheets</button>
        <button type="button" className="btn-ghost text-sm" disabled={!print.termId || !print.classId} onClick={() => {
          const q = `termId=${print.termId}&classId=${print.classId}${print.academicGroupId ? `&academicGroupId=${print.academicGroupId}` : ""}`;
          downloadPdf(`/s/${schoolSlug}/api/exams/pdf/academic-report?${q}`);
        }}>Academic performance report</button>
      </section>
    </div>
  );
};

export const ExamMultiGroupsPanel: React.FC<{ schoolSlug: string }> = ({ schoolSlug }) => {
  const { toast } = useToast();
  const { classes, subjects } = useExamMeta(schoolSlug);
  const [groups, setGroups] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [member, setMember] = useState({ groupId: "", memberType: "student", memberId: "" });
  const [students, setStudents] = useState<any[]>([]);

  const load = () => api.get(`/s/${schoolSlug}/api/exams/academic-groups`).then((r) => setGroups(r.data ?? []));
  useEffect(() => { load(); api.get(`/s/${schoolSlug}/api/students?limit=100`).then((r) => setStudents(r.data ?? [])); }, [schoolSlug]);

  return (
    <div className="space-y-4">
      <form className="card p-4 flex gap-2" onSubmit={async (e) => {
        e.preventDefault();
        await api.post(`/s/${schoolSlug}/api/exams/academic-groups`, { name });
        setName("");
        load();
        toast("Academic group created", "success");
      }}>
        <input className="input flex-1" placeholder="Multi-group name" required value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn-primary">Create</button>
      </form>
      <form className="card p-4 grid md:grid-cols-4 gap-2" onSubmit={async (e) => {
        e.preventDefault();
        await api.post(`/s/${schoolSlug}/api/exams/academic-groups/${member.groupId}/members`, member);
        load();
        toast("Member added", "success");
      }}>
        <select className="input" required value={member.groupId} onChange={(e) => setMember({ ...member, groupId: e.target.value })}>
          <option value="">Group</option>
          {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="input" value={member.memberType} onChange={(e) => setMember({ ...member, memberType: e.target.value })}>
          <option value="student">Student</option>
          <option value="class">Class</option>
          <option value="subject">Subject</option>
        </select>
        <select className="input" required value={member.memberId} onChange={(e) => setMember({ ...member, memberId: e.target.value })}>
          <option value="">Member</option>
          {member.memberType === "class" && classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          {member.memberType === "subject" && subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          {member.memberType === "student" && students.map((s: any) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
        </select>
        <button type="submit" className="btn-primary">Add member</button>
      </form>
      <ul className="space-y-3">
        {groups.map((g: any) => (
          <li key={g.id} className="card p-4">
            <p className="text-white font-medium">{g.name}</p>
            <ul className="text-slate-400 text-sm mt-2 space-y-1">
              {(g.members ?? []).map((m: any) => (
                <li key={m.id} className="capitalize">{m.memberType}: {m.memberId.slice(0, 8)}…</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};
