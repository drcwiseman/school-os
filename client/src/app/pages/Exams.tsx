import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { ConfirmAction } from "../components/ConfirmAction";
import { useAuth } from "../state/AuthContext";
import { downloadPdf } from "../api/client";
import { Loader2 } from "lucide-react";
import {
  ExamGroupsPanel, ExamTimetablePanel, ExamResultsPanel, ExamPrintingPanel, ExamMultiGroupsPanel,
} from "../components/exams/ExamEnhancementPanels";

export const Exams: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<
    "assessments" | "groups" | "timetable" | "marks" | "results" | "printing" | "multi-groups"
    | "moderation" | "reports" | "cbt" | "banks" | "rankings" | "analytics"
  >("assessments");
  const [examGroups, setExamGroups] = useState<any[]>([]);
  const [cbtPapers, setCbtPapers] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [rankings, setRankings] = useState<any[]>([]);
  const [examAnalytics, setExamAnalytics] = useState<any>(null);
  const [cbtForm, setCbtForm] = useState({ title: "", durationMinutes: "60", mode: "graded" });
  const [rankClassId, setRankClassId] = useState("");
  const [assessments, setAssessments] = useState<any[]>([]);
  const [moderation, setModeration] = useState<any[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", classId: "", subjectId: "", termId: "", examGroupId: "", sessionLabel: "" });
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; code?: string }[]>([]);
  const [marksAssessmentId, setMarksAssessmentId] = useState("");
  const [marksRows, setMarksRows] = useState<{ id?: string; studentId: string; score: string; grade?: string; remarks?: string; status?: string; label?: string }[]>([]);
  const [marksLoading, setMarksLoading] = useState(false);
  const [terms, setTerms] = useState<{ id: string; name: string }[]>([]);
  const [genForm, setGenForm] = useState({ termId: "", classId: "" });
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === "assessments") {
        const res = await api.get(`/s/${schoolSlug}/api/exams/assessments`);
        setAssessments(res.data ?? []);
      } else if (tab === "moderation") {
        const res = await api.get(`/s/${schoolSlug}/api/exams/moderation`);
        setModeration(res.data ?? []);
      } else if (tab === "cbt") {
        setCbtPapers((await api.get(`/s/${schoolSlug}/api/cbt/papers`)).data ?? []);
      } else if (tab === "banks") {
        setBanks((await api.get(`/s/${schoolSlug}/api/exams/question-banks`)).data ?? []);
      } else if (tab === "rankings" && rankClassId) {
        setRankings((await api.get(`/s/${schoolSlug}/api/exams/rankings?classId=${rankClassId}`)).data ?? []);
      } else if (tab === "analytics") {
        setExamAnalytics((await api.get(`/s/${schoolSlug}/api/exams/analytics`)).data);
      } else {
        const res = await api.get(`/s/${schoolSlug}/api/exams/report-cards`);
        setReportCards(res.data ?? []);
      }
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolSlug, tab, rankClassId]);

  useEffect(() => {
    if (!schoolSlug) return;
    Promise.all([
      api.get(`/s/${schoolSlug}/api/academics/classes`),
      api.get(`/s/${schoolSlug}/api/academics/subjects`),
      api.get(`/s/${schoolSlug}/api/academics/terms`),
      api.get(`/s/${schoolSlug}/api/exams/groups`),
    ]).then(([c, s, t, g]) => {
      setClasses(c.data ?? []);
      setSubjects(s.data ?? []);
      setTerms(t.data ?? []);
      setExamGroups(g.data ?? []);
    }).catch(() => {});
  }, [schoolSlug]);

  useEffect(() => {
    if (tab === "marks" && assessments.length === 0) {
      api.get(`/s/${schoolSlug}/api/exams/assessments`).then((res) => setAssessments(res.data ?? [])).catch(() => {});
    }
    if (tab === "marks" && marksAssessmentId) loadMarks(marksAssessmentId);
  }, [tab, marksAssessmentId]);

  const createAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/s/${schoolSlug}/api/exams/assessments`, form);
      setForm({ name: "", classId: "", subjectId: "", termId: "", examGroupId: "", sessionLabel: "" });
      load();
      toast("Assessment created", "success");
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const submitMarks = async (id: string) => {
    try {
      await api.post(`/s/${schoolSlug}/api/exams/assessments/${id}/submit`, {});
      toast("Marks submitted for moderation", "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const deleteAssessment = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/exams/assessments/${id}`);
      toast("Assessment removed", "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const loadMarks = async (assessmentId: string) => {
    if (!assessmentId) return;
    setMarksLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/exams/assessments/${assessmentId}/roster`);
      setMarksRows((res.data?.roster ?? []).map((r: any) => ({
        id: r.markId,
        studentId: r.studentId,
        score: r.score != null ? String(r.score) : "",
        grade: r.grade ?? "",
        remarks: r.remarks ?? "",
        status: r.status,
        label: `${r.firstName} ${r.lastName}`,
      })));
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setMarksLoading(false);
    }
  };

  const saveMarks = async () => {
    if (!marksAssessmentId) return toast("Select an assessment", "error");
    try {
      await api.put(`/s/${schoolSlug}/api/exams/assessments/${marksAssessmentId}/marks`, {
        entries: marksRows.map((r) => ({
          studentId: r.studentId,
          score: r.score === "" ? null : Number(r.score),
          grade: r.grade || undefined,
          remarks: r.remarks || undefined,
        })),
      });
      toast("Marks saved", "success");
      loadMarks(marksAssessmentId);
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const addMarkRow = () => {
    const studentId = window.prompt("Student UUID");
    if (!studentId) return;
    setMarksRows([...marksRows, { studentId, score: "" }]);
  };

  const removeMark = async (markId: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/exams/marks/${markId}`);
      toast("Mark removed", "success");
      loadMarks(marksAssessmentId);
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const generateReportCards = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await api.post(`/s/${schoolSlug}/api/exams/report-cards/generate`, genForm);
      const count = Array.isArray(res.data) ? res.data.length : 0;
      toast(`Generated ${count} report cards`, "success");
      setGenForm({ termId: "", classId: "" });
      load();
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setGenerating(false);
    }
  };

  const publishReport = async (id: string) => {
    try {
      await api.patch(`/s/${schoolSlug}/api/exams/report-cards/${id}/publish`, {});
      toast("Report card published to portal", "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const approve = async (id: string) => {
    try {
      await api.post(`/s/${schoolSlug}/api/exams/assessments/${id}/approve`, {});
      toast("Approved", "success");
      load();
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Exams & Results</h1>
          <p className="text-slate-400 mt-1">Assessments, moderation, and report cards</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(["assessments", "groups", "timetable", "marks", "results", "printing", "multi-groups", "moderation", "reports", "cbt", "banks", "rankings", "analytics"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm capitalize ${tab === t ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "assessments" && (
        <>
          <form onSubmit={createAssessment} className="card p-4 grid md:grid-cols-3 lg:grid-cols-6 gap-3">
            <input className="input" placeholder="Exam name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className="input" required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
              <option value="">Class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input" required value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">Subject</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="input" value={form.termId} onChange={(e) => setForm({ ...form, termId: e.target.value })}>
              <option value="">Term</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="input" value={form.examGroupId} onChange={(e) => setForm({ ...form, examGroupId: e.target.value })}>
              <option value="">Exam group</option>
              {examGroups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button type="submit" className="btn-primary">Add exam</button>
          </form>
          <DataTable loading={loading} rows={assessments} cols={[
            { k: "name", l: "Name" },
            { k: "type", l: "Type" },
            { k: "maxScore", l: "Max" },
          ]} actions={(row) => (
            <div className="flex gap-2">
              <button type="button" className="btn-ghost text-xs" onClick={() => { setMarksAssessmentId(row.id); setTab("marks"); }}>Enter marks</button>
              <button type="button" className="btn-ghost text-xs" onClick={() => submitMarks(row.id)}>Submit</button>
              {hasPermission("exams.moderate") && (
                <ConfirmAction
                  label="Remove"
                  confirmMessage={`Remove assessment "${row.name}"?`}
                  onConfirm={() => deleteAssessment(row.id)}
                />
              )}
            </div>
          )} />
        </>
      )}

      {tab === "groups" && schoolSlug && <ExamGroupsPanel schoolSlug={schoolSlug} />}
      {tab === "timetable" && schoolSlug && <ExamTimetablePanel schoolSlug={schoolSlug} />}
      {tab === "results" && schoolSlug && <ExamResultsPanel schoolSlug={schoolSlug} />}
      {tab === "printing" && schoolSlug && <ExamPrintingPanel schoolSlug={schoolSlug} />}
      {tab === "multi-groups" && schoolSlug && <ExamMultiGroupsPanel schoolSlug={schoolSlug} />}

      {tab === "marks" && (
        <div className="card p-4 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="label">Assessment</label>
              <select
                className="input"
                value={marksAssessmentId}
                onChange={(e) => { setMarksAssessmentId(e.target.value); loadMarks(e.target.value); }}
              >
                <option value="">Select assessment…</option>
                {assessments.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {hasPermission("exams.enter_marks") && (
              <>
                <button type="button" className="btn-ghost" onClick={addMarkRow}>Add row</button>
                <button type="button" className="btn-primary" onClick={saveMarks}>Save marks</button>
              </>
            )}
          </div>
          {marksLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
          ) : (
            <table className="table">
              <thead><tr><th>Student</th><th>Score</th><th>Grade</th><th>Remarks</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {marksRows.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-slate-400">No marks — select assessment or add rows.</td></tr>
                ) : marksRows.map((r, i) => (
                  <tr key={r.id ?? i}>
                    <td>{r.label ?? <span className="font-mono text-xs">{r.studentId.slice(0, 12)}…</span>}</td>
                    <td>
                      <input
                        className="input w-24"
                        type="number"
                        min={0}
                        value={r.score}
                        disabled={!hasPermission("exams.enter_marks")}
                        onChange={(e) => {
                          const next = [...marksRows];
                          next[i] = { ...r, score: e.target.value };
                          setMarksRows(next);
                        }}
                      />
                    </td>
                    <td><input className="input w-16 text-sm" value={r.grade ?? ""} disabled={!hasPermission("exams.enter_marks")} onChange={(e) => { const next = [...marksRows]; next[i] = { ...r, grade: e.target.value }; setMarksRows(next); }} /></td>
                    <td><input className="input w-28 text-sm" value={r.remarks ?? ""} disabled={!hasPermission("exams.enter_marks")} onChange={(e) => { const next = [...marksRows]; next[i] = { ...r, remarks: e.target.value }; setMarksRows(next); }} /></td>
                    <td className="capitalize text-sm">{r.status ?? "draft"}</td>
                    <td>
                      {r.id && hasPermission("exams.moderate") && (
                        <ConfirmAction label="Remove" confirmMessage="Remove this mark?" onConfirm={() => removeMark(r.id!)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "moderation" && (
        <DataTable loading={loading} rows={moderation} cols={[
          { k: "assessmentId", l: "Assessment" },
          { k: "submittedAt", l: "Submitted", r: (x) => new Date(x.submittedAt).toLocaleString() },
        ]} actions={(row) => (
          <button type="button" className="btn-ghost text-xs" onClick={() => approve(row.assessmentId)}>Approve</button>
        )} />
      )}

      {tab === "reports" && (
        <>
          {hasPermission("exams.publish") && (
            <form onSubmit={generateReportCards} className="card p-4 grid md:grid-cols-3 gap-3 items-end">
              <div>
                <label className="label">Term</label>
                <select className="input" required value={genForm.termId} onChange={(e) => setGenForm({ ...genForm, termId: e.target.value })}>
                  <option value="">Select term…</option>
                  {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Class</label>
                <select className="input" required value={genForm.classId} onChange={(e) => setGenForm({ ...genForm, classId: e.target.value })}>
                  <option value="">Select class…</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button type="submit" className="btn-primary" disabled={generating}>
                {generating ? "Generating…" : "Generate report cards"}
              </button>
              {genForm.termId && genForm.classId && (
                <button type="button" className="btn-ghost" onClick={async () => {
                  await api.post(`/s/${schoolSlug}/api/exams/report-cards/bulk-publish`, genForm);
                  toast("All report cards published", "success");
                  load();
                }}>Bulk publish</button>
              )}
            </form>
          )}
          <DataTable loading={loading} rows={reportCards} cols={[
          { k: "studentId", l: "Student" },
          { k: "published", l: "Published", r: (x) => x.published ? "Yes" : "No" },
        ]} actions={(row) => (
          <div className="flex gap-2">
            {!row.published && hasPermission("exams.publish") && (
              <button type="button" className="btn-ghost text-xs" onClick={() => publishReport(row.id)}>Publish</button>
            )}
            <button type="button" className="btn-ghost text-xs" onClick={() => downloadPdf(`/s/${schoolSlug}/api/reports/pdf/report-card/${row.id}`)}>Result PDF</button>
          </div>
        )} />
        </>
      )}

      {tab === "cbt" && (
        <div className="space-y-4">
          <form className="card p-4 flex flex-wrap gap-2" onSubmit={async (e) => {
            e.preventDefault();
            await api.post(`/s/${schoolSlug}/api/cbt/papers`, { title: cbtForm.title, durationMinutes: Number(cbtForm.durationMinutes), mode: cbtForm.mode });
            setCbtForm({ title: "", durationMinutes: "60", mode: "graded" });
            load();
            toast("CBT paper created", "success");
          }}>
            <input className="input flex-1" placeholder="Paper title" required value={cbtForm.title} onChange={(e) => setCbtForm({ ...cbtForm, title: e.target.value })} />
            <input className="input w-24" type="number" value={cbtForm.durationMinutes} onChange={(e) => setCbtForm({ ...cbtForm, durationMinutes: e.target.value })} />
            <select className="input w-32" value={cbtForm.mode} onChange={(e) => setCbtForm({ ...cbtForm, mode: e.target.value })}>
              <option value="graded">Graded</option>
              <option value="practice">Practice</option>
            </select>
            <button type="submit" className="btn-primary">Create paper</button>
          </form>
          <DataTable loading={loading} rows={cbtPapers} cols={[
            { k: "title", l: "Title" },
            { k: "mode", l: "Mode" },
            { k: "published", l: "Live", r: (x) => x.published ? "Yes" : "No" },
          ]} actions={(row) => (
            <button type="button" className="btn-ghost text-xs" onClick={async () => {
              await api.patch(`/s/${schoolSlug}/api/cbt/papers/${row.id}`, { published: !row.published });
              load();
            }}>{row.published ? "Unpublish" : "Publish"}</button>
          )} />
        </div>
      )}

      {tab === "banks" && (
        <div className="card p-4">
          <button type="button" className="btn-primary mb-4" onClick={async () => {
            const name = window.prompt("Bank name");
            if (!name) return;
            await api.post(`/s/${schoolSlug}/api/exams/question-banks`, { name });
            load();
          }}>New question bank</button>
          {banks.map((b) => <p key={b.id} className="text-slate-300">{b.name}</p>)}
        </div>
      )}

      {tab === "rankings" && (
        <div className="space-y-4">
          <select className="input max-w-xs" value={rankClassId} onChange={(e) => setRankClassId(e.target.value)}>
            <option value="">Select class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <DataTable loading={loading} rows={rankings} cols={[
            { k: "firstName", l: "Student", r: (x) => `${x.firstName} ${x.lastName}` },
            { k: "rank", l: "Rank" },
            { k: "average", l: "Average", r: (x) => x.average?.toFixed(1) ?? "—" },
          ]} />
        </div>
      )}

      {tab === "analytics" && examAnalytics && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="card p-4"><p className="text-slate-500 text-sm">Pass rate</p><p className="text-2xl font-bold text-white">{examAnalytics.passRate}%</p></div>
          <div className="card p-4"><p className="text-slate-500 text-sm">Marks sampled</p><p className="text-2xl font-bold text-white">{examAnalytics.totalMarks}</p></div>
          <div className="card p-4 col-span-full">
            <p className="text-slate-400 text-sm mb-2">Distribution</p>
            <pre className="text-xs text-slate-300">{JSON.stringify(examAnalytics.distribution, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

function DataTable({ loading, rows, cols, actions }: { loading: boolean; rows: any[]; cols: { k: string; l: string; r?: (x: any) => string }[]; actions?: (row: any) => React.ReactNode }) {
  if (loading) return (
    <div className="flex justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
    </div>
  );
  return (
    <div className="card overflow-hidden">
      <table className="table">
        <thead><tr>{cols.map((c) => <th key={c.k}>{c.l}</th>)}{actions && <th>Actions</th>}</tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={cols.length + (actions ? 1 : 0)} className="text-center py-8 text-slate-400">No records</td></tr>
            : rows.map((row) => (
              <tr key={row.id}>
                {cols.map((c) => <td key={c.k}>{c.r ? c.r(row) : String(row[c.k] ?? "—")}</td>)}
                {actions && <td>{actions(row)}</td>}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
