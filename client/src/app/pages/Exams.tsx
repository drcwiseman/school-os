import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { ConfirmAction } from "../components/ConfirmAction";
import { useAuth } from "../state/AuthContext";
import { downloadPdf } from "../api/client";
import { Loader2 } from "lucide-react";

export const Exams: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState<"assessments" | "marks" | "moderation" | "reports">("assessments");
  const [assessments, setAssessments] = useState<any[]>([]);
  const [moderation, setModeration] = useState<any[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", classId: "", subjectId: "" });
  const [marksAssessmentId, setMarksAssessmentId] = useState("");
  const [marksRows, setMarksRows] = useState<{ id?: string; studentId: string; score: string; status?: string }[]>([]);
  const [marksLoading, setMarksLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === "assessments") {
        const res = await api.get(`/s/${schoolSlug}/api/exams/assessments`);
        setAssessments(res.data ?? []);
      } else if (tab === "moderation") {
        const res = await api.get(`/s/${schoolSlug}/api/exams/moderation`);
        setModeration(res.data ?? []);
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

  useEffect(() => { load(); }, [schoolSlug, tab]);

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
      setForm({ name: "", classId: "", subjectId: "" });
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
      const res = await api.get(`/s/${schoolSlug}/api/exams/assessments/${assessmentId}/marks`);
      setMarksRows((res.data?.marks ?? []).map((m: any) => ({
        id: m.id,
        studentId: m.studentId,
        score: m.score != null ? String(m.score) : "",
        status: m.status,
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
        {(["assessments", "marks", "moderation", "reports"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm capitalize ${tab === t ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "assessments" && (
        <>
          <form onSubmit={createAssessment} className="card p-4 grid md:grid-cols-4 gap-3">
            <input className="input" placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Class UUID" required value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} />
            <input className="input" placeholder="Subject UUID" required value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} />
            <button type="submit" className="btn-primary">Add Assessment</button>
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
              <thead><tr><th>Student</th><th>Score</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {marksRows.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-slate-400">No marks — select assessment or add rows.</td></tr>
                ) : marksRows.map((r, i) => (
                  <tr key={r.id ?? i}>
                    <td className="font-mono text-xs">{r.studentId.slice(0, 12)}…</td>
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
        <DataTable loading={loading} rows={reportCards} cols={[
          { k: "studentId", l: "Student" },
          { k: "published", l: "Published", r: (x) => x.published ? "Yes" : "No" },
        ]} actions={(row) => (
          <div className="flex gap-2">
            {!row.published && hasPermission("exams.publish") && (
              <button type="button" className="btn-ghost text-xs" onClick={() => publishReport(row.id)}>Publish</button>
            )}
            <button type="button" className="btn-ghost text-xs" onClick={() => downloadPdf(`/s/${schoolSlug}/api/reports/pdf/report-card/${row.id}`)}>PDF</button>
          </div>
        )} />
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
