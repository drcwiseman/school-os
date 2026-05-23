import { useCallback, useEffect, useState } from "react";
import { api } from "../../../api/client";
import { CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "../../../components/Toast";

type AssignmentRow = {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  subjectName?: string;
  className?: string;
  overdue?: boolean;
  submission?: {
    id: string;
    content?: string;
    status: string;
    score?: string;
    feedback?: string;
    gradedAt?: string;
    submittedAt?: string;
  } | null;
};

export function StudentHomeworkPanel({ schoolSlug }: { schoolSlug: string }) {
  const { toast } = useToast();
  const [items, setItems] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/portal/student/assignments`);
      const rows: AssignmentRow[] = res.data ?? [];
      setItems(rows);
      const init: Record<string, string> = {};
      for (const a of rows) {
        if (a.submission?.content) init[a.id] = a.submission.content;
      }
      setDrafts((d) => ({ ...init, ...d }));
    } catch (e: any) {
      toast(e.message ?? "Could not load homework", "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast]);

  useEffect(() => { load(); }, [load]);

  const save = async (assignmentId: string, draft: boolean) => {
    const content = drafts[assignmentId]?.trim();
    if (!content) {
      toast("Enter your answer first", "error");
      return;
    }
    setSaving(assignmentId);
    try {
      const item = items.find((a) => a.id === assignmentId);
      const method = item?.submission ? "patch" : "post";
      const path = `/s/${schoolSlug}/api/portal/student/assignments/${assignmentId}${item?.submission ? "/submission" : "/submit"}`;
      if (method === "patch") {
        await api.patch(path, { content, draft });
      } else {
        await api.post(path, { content, draft });
      }
      toast(draft ? "Draft saved" : "Submitted", "success");
      await load();
    } catch (e: any) {
      toast(e.message ?? "Save failed", "error");
    } finally {
      setSaving(null);
    }
  };

  const withdraw = async (assignmentId: string) => {
    if (!window.confirm("Withdraw this submission? You can submit again later.")) return;
    try {
      await api.delete(`/s/${schoolSlug}/api/portal/student/assignments/${assignmentId}/submission`);
      toast("Submission withdrawn", "success");
      await load();
    } catch (e: any) {
      toast(e.message ?? "Could not withdraw", "error");
    }
  };

  if (loading) return <p className="portal-empty text-sm">Loading assignments…</p>;
  if (!items.length) return <p className="portal-empty text-sm">No homework assigned for your class.</p>;

  return (
    <ul className="space-y-3">
      {items.map((a) => {
        const sub = a.submission;
        const isGraded = Boolean(sub?.gradedAt);
        const isOpen = expanded === a.id;
        const canEdit = !isGraded && (!sub || sub.status === "draft" || sub.status === "submitted");
        return (
          <li key={a.id} className="rounded-xl border border-[var(--portal-border)] overflow-hidden">
            <button
              type="button"
              className="w-full text-left px-4 py-3 flex items-start justify-between gap-2"
              onClick={() => setExpanded(isOpen ? null : a.id)}
            >
              <div className="min-w-0">
                <p className="font-medium text-[var(--portal-fg-strong)]">{a.title}</p>
                <p className="text-xs text-[var(--portal-subtle)] mt-0.5">
                  {[a.subjectName, a.className].filter(Boolean).join(" · ")}
                  {a.dueDate && ` · Due ${new Date(a.dueDate).toLocaleDateString()}`}
                </p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {sub?.status === "submitted" && !isGraded && (
                    <span className="text-[10px] student-portal-pill student-portal-pill--ok inline-flex items-center gap-0.5">
                      <CheckCircle className="w-3 h-3" /> Submitted
                    </span>
                  )}
                  {sub?.status === "draft" && (
                    <span className="text-[10px] student-portal-pill student-portal-pill--warn">Draft</span>
                  )}
                  {isGraded && (
                    <span className="text-[10px] student-portal-pill student-portal-pill--ok">
                      Graded{sub?.score != null ? `: ${sub.score}` : ""}
                    </span>
                  )}
                  {a.overdue && !sub?.submittedAt && (
                    <span className="text-[10px] student-portal-pill student-portal-pill--danger inline-flex items-center gap-0.5">
                      <AlertCircle className="w-3 h-3" /> Overdue
                    </span>
                  )}
                </div>
              </div>
              {isOpen ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
            </button>
            {isOpen && (
              <div className="px-4 pb-4 border-t border-[var(--portal-border-soft)] space-y-3">
                {a.description && <p className="text-sm text-[var(--portal-muted)] pt-3">{a.description}</p>}
                {sub?.feedback && (
                  <p className="text-sm rounded-lg bg-[var(--portal-surface-muted)] px-3 py-2">
                    <span className="font-medium">Teacher feedback:</span> {sub.feedback}
                  </p>
                )}
                {canEdit ? (
                  <>
                    <textarea
                      className="portal-input w-full rounded-lg min-h-[100px] text-sm"
                      value={drafts[a.id] ?? ""}
                      onChange={(e) => setDrafts({ ...drafts, [a.id]: e.target.value })}
                      placeholder="Type your answer…"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving === a.id}
                        className="portal-btn-primary rounded-lg text-white text-xs px-3 py-1.5"
                        onClick={() => save(a.id, false)}
                      >
                        Submit
                      </button>
                      <button
                        type="button"
                        disabled={saving === a.id}
                        className="rounded-lg border border-[var(--portal-border)] text-xs px-3 py-1.5"
                        onClick={() => save(a.id, true)}
                      >
                        Save draft
                      </button>
                      {sub && !isGraded && (
                        <button type="button" className="text-xs text-red-600 dark:text-red-400" onClick={() => withdraw(a.id)}>
                          Withdraw
                        </button>
                      )}
                    </div>
                  </>
                ) : sub?.content ? (
                  <p className="text-sm text-[var(--portal-muted)] whitespace-pre-wrap">{sub.content}</p>
                ) : (
                  <p className="text-xs text-[var(--portal-subtle)] flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Graded — no further edits</p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
