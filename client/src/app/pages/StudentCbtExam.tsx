import React, { useEffect, useState, useCallback } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Clock, Lock } from "lucide-react";

type Question = {
  id: string;
  prompt: string;
  questionType: string;
  optionsJson?: string[];
  points: number;
  maxWords?: number;
};

const PORTAL_CBT = (slug: string) => `/s/${slug}/api/portal/student/cbt`;

export const StudentCbtExam: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [search] = useSearchParams();
  const { toast } = useToast();
  const paperId = search.get("paperId") ?? "";
  const [session, setSession] = useState<any>(null);
  const [paper, setPaper] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [remaining, setRemaining] = useState(0);
  const [done, setDone] = useState(false);
  const [finalScore, setFinalScore] = useState<{ score?: number; maxScore?: number } | null>(null);

  const start = useCallback(async () => {
    if (!paperId || !schoolSlug) return;
    const res = await api.post(`${PORTAL_CBT(schoolSlug)}/sessions/start`, { paperId });
    const d = res.data;
    setSession(d.session);
    setPaper(d.paper);
    setQuestions(d.questions ?? []);
    const ends = new Date(d.session.endsAt).getTime();
    setRemaining(Math.max(0, Math.floor((ends - Date.now()) / 1000)));
    if (d.paper?.lockdown) {
      try {
        document.documentElement.requestFullscreen?.();
      } catch { /* ignore */ }
    }
  }, [schoolSlug, paperId]);

  useEffect(() => {
    start().catch((e) => toast(e.message, "error"));
  }, [start, toast]);

  useEffect(() => {
    if (!session || done) return;
    const t = setInterval(() => setRemaining((r) => {
      if (r <= 1) {
        submit();
        return 0;
      }
      return r - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [session, done]);

  useEffect(() => {
    const onBlur = () => {
      if (paper?.lockdown) toast("Stay on the exam window", "error");
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [paper, toast]);

  const saveAnswer = async (qid: string, answer: number | string) => {
    if (!session || !schoolSlug) return;
    setAnswers((a) => ({ ...a, [qid]: answer }));
    await api.post(`${PORTAL_CBT(schoolSlug)}/sessions/${session.id}/answer`, { questionId: qid, answer });
  };

  const submit = async () => {
    if (!session || !schoolSlug) return;
    const res = await api.post(`${PORTAL_CBT(schoolSlug)}/sessions/${session.id}/submit`);
    setFinalScore({ score: res.data?.score, maxScore: res.data?.maxScore });
    setDone(true);
    toast(paper?.mode === "practice" ? "Practice complete" : "Exam submitted", "success");
  };

  const q = questions[idx];
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  if (!session) {
    return (
      <div className="portal-shell student-portal min-h-screen p-8">
        <p className="text-[var(--portal-muted)]">Loading exam…</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="portal-shell student-portal min-h-screen flex items-center justify-center p-6">
        <div className="rounded-xl border border-[var(--portal-border)] p-8 max-w-lg w-full text-center bg-[var(--portal-surface)]">
          <h2 className="text-xl font-bold text-[var(--portal-fg-strong)]">Submitted</h2>
          <p className="text-[var(--portal-muted)] mt-2">
            Score: {finalScore?.score ?? session.score ?? "pending grading"} / {finalScore?.maxScore ?? session.maxScore}
          </p>
          {schoolSlug && (
            <Link to={`/s/${schoolSlug}/student`} className="portal-btn-primary inline-block mt-6 rounded-lg text-white text-sm px-4 py-2">
              Back to portal
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="portal-shell student-portal min-h-screen max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-[var(--portal-fg-strong)]">{paper?.title}</h1>
        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-mono">
          <Clock className="w-4 h-4" /> {mins}:{secs.toString().padStart(2, "0")}
        </span>
      </div>
      {paper?.lockdown && (
        <p className="text-xs text-[var(--portal-subtle)] flex items-center gap-1">
          <Lock className="w-3 h-3" /> Lockdown mode
        </p>
      )}

      {q && (
        <div className="rounded-xl border border-[var(--portal-border)] p-6 space-y-4 bg-[var(--portal-surface)]">
          <p className="text-[var(--portal-subtle)] text-sm">Question {idx + 1} of {questions.length}</p>
          <p className="text-[var(--portal-fg-strong)] text-lg">{q.prompt}</p>
          {q.questionType === "mcq" && (q.optionsJson ?? []).map((opt, i) => (
            <label key={i} className="flex items-center gap-2 p-3 rounded-lg border border-[var(--portal-border)] cursor-pointer">
              <input
                type="radio"
                name={q.id}
                checked={answers[q.id] === i}
                onChange={() => saveAnswer(q.id, i)}
              />
              <span className="text-[var(--portal-fg)]">{opt}</span>
            </label>
          ))}
          {q.questionType === "essay" && (
            <textarea
              className="portal-input w-full min-h-[120px] rounded-lg"
              maxLength={q.maxWords ? q.maxWords * 6 : undefined}
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              onBlur={() => saveAnswer(q.id, (answers[q.id] as string) ?? "")}
            />
          )}
        </div>
      )}

      <div className="flex justify-between">
        <button type="button" className="rounded-lg border border-[var(--portal-border)] px-3 py-2 text-sm" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>Previous</button>
        {idx < questions.length - 1 ? (
          <button type="button" className="portal-btn-primary rounded-lg text-white px-4 py-2 text-sm" onClick={() => setIdx((i) => i + 1)}>Next</button>
        ) : (
          <button type="button" className="portal-btn-primary rounded-lg text-white px-4 py-2 text-sm" onClick={submit}>Submit exam</button>
        )}
      </div>
    </div>
  );
};
