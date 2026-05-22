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
import { PageTabs } from "../components/PageTabs";
import { ResponsiveDataTable } from "../components/ResponsiveDataTable";
import { ClipboardList } from "lucide-react";

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

  const examTabs = [
    { id: "assessments" as const, label: "Assessments" },
    { id: "marks" as const, label: "Enter marks" },
    { id: "reports" as const, label: "Report cards" },
    { id: "results" as const, label: "Results" },
    { id: "moderation" as const, label: "Moderation" },
    { id: "groups" as const, label: "Groups" },
    { id: "timetable" as const, label: "Timetable" },
    { id: "printing" as const, label: "Printing" },
    { id: "multi-groups" as const, label: "Multi-groups" },
    { id: "cbt" as const, label: "CBT" },
    { id: "banks" as const, label: "Question bank" },
    { id: "rankings" as const, label: "Rankings" },
    { id: "analytics" as const, label: "Analytics" },
  ];

  const panelLoading = loading && ["assessments", "moderation", "reports", "cbt", "banks", "rankings", "analytics"].includes(tab);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="page-title flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary-400 shrink-0" />
            Exams & Results
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Assessments, marks, moderation, and report cards by class and term</p>
        </div>
      </div>

      <PageTabs tabs={examTabs} value={tab} onChange={setTab} />

      {panelLoading && (
        <div className="content-loader"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
      )}

      {!panelLoading && tab === "assessments" && (
        <>
          <form onSubmit={createAssessment} className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <input className="input sm:col-span-2 lg:col-span-1" placeholder="Exam name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
            <button type="submit" className="btn-primary w-full sm:w-auto">Add exam</button>
          </form>
          <ResponsiveDataTable
            rows={assessments}
            columns={[
              { key: "name", label: "Name" },
              { key: "type", label: "Type" },
              { key: "maxScore", label: "Max score" },
            ]}
            actions={(row) => (
              <div className="flex flex-wrap gap-2 justify-end">
                <button type="button" className="btn-ghost text-xs" onClick={() => { setMarksAssessmentId(row.id); setTab("marks"); }}>Marks</button>
                <button type="button" className="btn-ghost text-xs" onClick={() => submitMarks(row.id)}>Submit</button>
                {hasPermission("exams.moderate") && (
                  <ConfirmAction
                    label="Remove"
                    confirmMessage={`Remove assessment "${row.name}"?`}
                    onConfirm={() => deleteAssessment(row.id)}
                  />
                )}
              </div>
            )}
          />
        </>
      )}

      {!panelLoading && tab === "groups" && schoolSlug && <ExamGroupsPanel schoolSlug={schoolSlug} />}
      {!panelLoading && tab === "timetable" && schoolSlug && <ExamTimetablePanel schoolSlug={schoolSlug} />}
      {!panelLoading && tab === "results" && schoolSlug && <ExamResultsPanel schoolSlug={schoolSlug} />}
      {!panelLoading && tab === "printing" && schoolSlug && <ExamPrintingPanel schoolSlug={schoolSlug} />}
      {!panelLoading && tab === "multi-groups" && schoolSlug && <ExamMultiGroupsPanel schoolSlug={schoolSlug} />}

      {!panelLoading && tab === "marks" && (
        <div className="card p-4 space-y-4 w-full min-w-0">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-end">
            <div className="flex-1 min-w-0 w-full sm:min-w-[200px]">
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
          ) : marksRows.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">No marks — select an assessment.</p>
          ) : (
            <>
              <div className="hidden md:block table-wrap">
                <table className="table min-w-[720px]">
                  <thead><tr><th>Student</th><th>Score</th><th>Grade</th><th>Remarks</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {marksRows.map((r, i) => (
                      <tr key={r.id ?? i}>
                        <td>{r.label ?? <span className="font-mono text-xs">{r.studentId.slice(0, 12)}…</span>}</td>
                        <td>
                          <input className="input w-full max-w-[6rem]" type="number" min={0} value={r.score} disabled={!hasPermission("exams.enter_marks")} onChange={(e) => { const next = [...marksRows]; next[i] = { ...r, score: e.target.value }; setMarksRows(next); }} />
                        </td>
                        <td><input className="input w-full max-w-[4rem] text-sm" value={r.grade ?? ""} disabled={!hasPermission("exams.enter_marks")} onChange={(e) => { const next = [...marksRows]; next[i] = { ...r, grade: e.target.value }; setMarksRows(next); }} /></td>
                        <td><input className="input w-full max-w-[8rem] text-sm" value={r.remarks ?? ""} disabled={!hasPermission("exams.enter_marks")} onChange={(e) => { const next = [...marksRows]; next[i] = { ...r, remarks: e.target.value }; setMarksRows(next); }} /></td>
                        <td className="capitalize text-sm">{r.status ?? "draft"}</td>
                        <td>{r.id && hasPermission("exams.moderate") && <ConfirmAction label="Remove" confirmMessage="Remove this mark?" onConfirm={() => removeMark(r.id!)} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden space-y-3">
                {marksRows.map((r, i) => (
                  <div key={r.id ?? i} className="rounded-xl border border-slate-700/60 p-3 space-y-2 bg-slate-900/30">
                    <p className="font-medium text-white text-sm">{r.label ?? r.studentId}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="label">Score</label><input className="input" type="number" value={r.score} disabled={!hasPermission("exams.enter_marks")} onChange={(e) => { const next = [...marksRows]; next[i] = { ...r, score: e.target.value }; setMarksRows(next); }} /></div>
                      <div><label className="label">Grade</label><input className="input" value={r.grade ?? ""} disabled={!hasPermission("exams.enter_marks")} onChange={(e) => { const next = [...marksRows]; next[i] = { ...r, grade: e.target.value }; setMarksRows(next); }} /></div>
                    </div>
                    <div><label className="label">Remarks</label><input className="input" value={r.remarks ?? ""} disabled={!hasPermission("exams.enter_marks")} onChange={(e) => { const next = [...marksRows]; next[i] = { ...r, remarks: e.target.value }; setMarksRows(next); }} /></div>
                    <p className="text-xs text-slate-500 capitalize">Status: {r.status ?? "draft"}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!panelLoading && tab === "moderation" && (
        <ResponsiveDataTable
          rows={moderation}
          columns={[
            { key: "assessmentId", label: "Assessment", render: (x) => <span className="font-mono text-xs">{String(x.assessmentId).slice(0, 8)}…</span> },
            { key: "submittedAt", label: "Submitted", render: (x) => new Date(x.submittedAt).toLocaleString() },
          ]}
          actions={(row) => (
            <button type="button" className="btn-ghost text-xs" onClick={() => approve(row.assessmentId)}>Approve</button>
          )}
        />
      )}

      {!panelLoading && tab === "reports" && (
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
          <ResponsiveDataTable
            rows={reportCards}
            columns={[
              { key: "studentId", label: "Student", render: (x) => <span className="font-mono text-xs">{String(x.studentId).slice(0, 8)}…</span> },
              { key: "published", label: "Published", render: (x) => (x.published ? "Yes" : "No") },
            ]}
            actions={(row) => (
              <div className="flex flex-wrap gap-2 justify-end">
                {!row.published && hasPermission("exams.publish") && (
                  <button type="button" className="btn-ghost text-xs" onClick={() => publishReport(row.id)}>Publish</button>
                )}
                <button type="button" className="btn-ghost text-xs" onClick={() => downloadPdf(`/s/${schoolSlug}/api/reports/pdf/report-card/${row.id}`)}>PDF</button>
              </div>
            )}
          />
        </>
      )}

      {!panelLoading && tab === "cbt" && (
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
          <ResponsiveDataTable
            rows={cbtPapers}
            columns={[
              { key: "title", label: "Title" },
              { key: "mode", label: "Mode" },
              { key: "published", label: "Live", render: (x) => (x.published ? "Yes" : "No") },
            ]}
            actions={(row) => (
              <button type="button" className="btn-ghost text-xs" onClick={async () => {
                await api.patch(`/s/${schoolSlug}/api/cbt/papers/${row.id}`, { published: !row.published });
                load();
              }}>{row.published ? "Unpublish" : "Publish"}</button>
            )}
          />
        </div>
      )}

      {!panelLoading && tab === "banks" && (
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

      {!panelLoading && tab === "rankings" && (
        <div className="space-y-4">
          <select className="input w-full max-w-md" value={rankClassId} onChange={(e) => setRankClassId(e.target.value)}>
            <option value="">Select class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ResponsiveDataTable
            loading={loading}
            rows={rankings}
            columns={[
              { key: "firstName", label: "Student", render: (x) => `${x.firstName} ${x.lastName}` },
              { key: "rank", label: "Rank" },
              { key: "average", label: "Average", render: (x) => x.average?.toFixed(1) ?? "—" },
            ]}
            emptyMessage={rankClassId ? "No rankings for this class." : "Select a class."}
          />
        </div>
      )}

      {!panelLoading && tab === "analytics" && examAnalytics && (
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
