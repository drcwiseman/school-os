import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../../api/client";
import { BookOpen, Play, RotateCcw, CheckCircle, Clock } from "lucide-react";

type Paper = {
  id: string;
  title: string;
  durationMinutes: number;
  mode: string;
  subjectName?: string;
  inProgressSessionId?: string | null;
  latestSession?: { id: string; status: string; score?: number; maxScore?: number; submittedAt?: string } | null;
};

type SessionRow = {
  id: string;
  paperId: string;
  paperTitle: string;
  mode: string;
  status: string;
  score?: number;
  maxScore?: number;
  startedAt: string;
  submittedAt?: string;
};

export function StudentCbtPanel({ schoolSlug }: { schoolSlug: string }) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/portal/student/cbt/papers`),
        api.get(`/s/${schoolSlug}/api/portal/student/cbt/sessions`),
      ]);
      setPapers(p.data ?? []);
      setSessions(s.data ?? []);
    } catch {
      setPapers([]);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [schoolSlug]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="portal-empty text-sm">Loading exams…</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--portal-muted)]">
        Computer-based tests assigned to your class. Resume in-progress exams or review past attempts.
      </p>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider portal-accent-text mb-3">Available exams</h3>
        {papers.length === 0 ? (
          <p className="portal-empty text-sm">No published CBT papers right now.</p>
        ) : (
          <ul className="space-y-3">
            {papers.map((paper) => {
              const resumeId = paper.inProgressSessionId;
              const graded = paper.latestSession?.status === "graded";
              return (
                <li key={paper.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--portal-border)] px-4 py-3">
                  <div>
                    <p className="font-medium text-[var(--portal-fg-strong)]">{paper.title}</p>
                    <p className="text-xs text-[var(--portal-subtle)]">
                      {paper.durationMinutes ?? 60} min · {paper.mode === "practice" ? "Practice" : "Graded"}
                      {paper.subjectName ? ` · ${paper.subjectName}` : ""}
                    </p>
                    {paper.latestSession && !resumeId && (
                      <p className="text-xs mt-1 text-[var(--portal-muted)]">
                        Last: {paper.latestSession.status.replace(/_/g, " ")}
                        {graded && paper.latestSession.score != null && ` · ${paper.latestSession.score}/${paper.latestSession.maxScore}`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {resumeId ? (
                      <Link
                        to={`/s/${schoolSlug}/exam?paperId=${paper.id}`}
                        className="portal-btn-primary rounded-lg text-white text-xs font-semibold px-4 py-2 inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Resume
                      </Link>
                    ) : (
                      <Link
                        to={`/s/${schoolSlug}/exam?paperId=${paper.id}`}
                        className="portal-btn-primary rounded-lg text-white text-xs font-semibold px-4 py-2 inline-flex items-center gap-1"
                      >
                        <Play className="w-3.5 h-3.5" /> {paper.latestSession ? "Retake" : "Start"}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider portal-accent-text mb-3">Exam history</h3>
        {sessions.length === 0 ? (
          <p className="portal-empty text-sm">No attempts yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="rounded-lg border border-[var(--portal-border)] px-3 py-2 flex justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <BookOpen className="w-4 h-4 shrink-0 portal-accent-text" />
                  <span className="truncate text-[var(--portal-fg-strong)]">{s.paperTitle}</span>
                </span>
                <span className="text-xs text-[var(--portal-subtle)] shrink-0 text-right">
                  {s.status === "graded" && s.score != null ? (
                    <span className="inline-flex items-center gap-0.5 student-portal-pill student-portal-pill--ok text-[10px]">
                      <CheckCircle className="w-3 h-3" /> {s.score}/{s.maxScore}
                    </span>
                  ) : s.status === "in_progress" ? (
                    <Link to={`/s/${schoolSlug}/exam?paperId=${s.paperId}`} className="portal-accent-text">Resume</Link>
                  ) : (
                    <span className="capitalize">{s.status.replace(/_/g, " ")}</span>
                  )}
                  <br />
                  <Clock className="w-3 h-3 inline mr-0.5" />
                  {new Date(s.startedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
