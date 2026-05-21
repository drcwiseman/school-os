import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../api/client";
import { useToast } from "../Toast";
import { Loader2 } from "lucide-react";

export const HomeworkGradingPanel: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<Record<string, { score: string; feedback: string }>>({});

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/academics/assignments`)
      .then((r) => setAssignments(r.data ?? []))
      .finally(() => setLoading(false));
  }, [schoolSlug]);

  useEffect(() => {
    if (!selectedId) return;
    api.get(`/s/${schoolSlug}/api/academics/assignments/${selectedId}/submissions`)
      .then((r) => {
        const list = r.data ?? [];
        setSubmissions(list);
        const g: Record<string, { score: string; feedback: string }> = {};
        for (const s of list) {
          g[s.id] = { score: s.score != null ? String(s.score) : "", feedback: s.feedback ?? "" };
        }
        setGrades(g);
      });
  }, [selectedId, schoolSlug]);

  const saveGrade = async (submissionId: string) => {
    const g = grades[submissionId];
    if (!g?.score) return toast("Enter a score", "error");
    try {
      await api.patch(`/s/${schoolSlug}/api/academics/assignments/submissions/${submissionId}/grade`, {
        score: Number(g.score),
        feedback: g.feedback || undefined,
      });
      toast("Graded", "success");
      const r = await api.get(`/s/${schoolSlug}/api/academics/assignments/${selectedId}/submissions`);
      setSubmissions(r.data ?? []);
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <label className="label">Select homework</label>
        <select className="input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">Choose assignment…</option>
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>{a.title} — due {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}</option>
          ))}
        </select>
      </div>
      {selectedId && (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr><th>Student</th><th>Submitted</th><th>Work</th><th>Score</th><th>Feedback</th><th /></tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id}>
                  <td>{s.firstName} {s.lastName}<br /><span className="text-xs text-slate-500">{s.admissionNumber}</span></td>
                  <td className="text-xs">{new Date(s.submittedAt).toLocaleString()}<br /><span className="capitalize">{s.status}</span></td>
                  <td className="max-w-xs text-sm text-slate-400 truncate">{s.content ?? "—"}</td>
                  <td>
                    <input
                      className="input w-20"
                      type="number"
                      min={0}
                      max={100}
                      value={grades[s.id]?.score ?? ""}
                      onChange={(e) => setGrades({ ...grades, [s.id]: { ...grades[s.id], score: e.target.value, feedback: grades[s.id]?.feedback ?? "" } })}
                    />
                  </td>
                  <td>
                    <input
                      className="input w-40"
                      value={grades[s.id]?.feedback ?? ""}
                      onChange={(e) => setGrades({ ...grades, [s.id]: { score: grades[s.id]?.score ?? "", feedback: e.target.value } })}
                      placeholder="Feedback"
                    />
                  </td>
                  <td><button type="button" className="btn-primary text-xs" onClick={() => saveGrade(s.id)}>Save</button></td>
                </tr>
              ))}
              {!submissions.length && <tr><td colSpan={6} className="text-slate-500">No submissions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
