import React, { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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

export const StudentCbtExam: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [search] = useSearchParams();
  const { toast } = useToast();
  const paperId = search.get("paperId") ?? "";
  const studentId = search.get("studentId") ?? "";
  const [session, setSession] = useState<any>(null);
  const [paper, setPaper] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | string>>({});
  const [remaining, setRemaining] = useState(0);
  const [done, setDone] = useState(false);

  const start = useCallback(async () => {
    if (!paperId || !studentId) return;
    const res = await api.post(`/s/${schoolSlug}/api/cbt/sessions/start`, { paperId, studentId });
    setSession(res.data.session);
    setPaper(res.data.paper);
    setQuestions(res.data.questions ?? []);
    const ends = new Date(res.data.session.endsAt).getTime();
    setRemaining(Math.max(0, Math.floor((ends - Date.now()) / 1000)));
    if (res.data.paper?.lockdown) {
      try {
        document.documentElement.requestFullscreen?.();
      } catch { /* ignore */ }
    }
  }, [schoolSlug, paperId, studentId]);

  useEffect(() => { start().catch((e) => toast(e.message, "error")); }, [start]);

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
  }, [paper]);

  const saveAnswer = async (qid: string, answer: number | string) => {
    setAnswers((a) => ({ ...a, [qid]: answer }));
    await api.post(`/s/${schoolSlug}/api/cbt/sessions/${session.id}/answer`, { questionId: qid, answer });
  };

  const submit = async () => {
    if (!session) return;
    await api.post(`/s/${schoolSlug}/api/cbt/sessions/${session.id}/submit`);
    setDone(true);
    toast(paper?.mode === "practice" ? "Practice complete" : "Exam submitted", "success");
  };

  const q = questions[idx];
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  if (!session) return <p className="text-slate-400 p-8">Loading exam…</p>;

  if (done) {
    return (
      <div className="card p-8 max-w-lg mx-auto mt-12 text-center">
        <h2 className="text-xl font-bold text-white">Submitted</h2>
        <p className="text-slate-400 mt-2">Score: {session.score ?? "pending grading"} / {session.maxScore}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-white">{paper?.title}</h1>
        <span className="flex items-center gap-1 text-amber-400 font-mono">
          <Clock className="w-4 h-4" /> {mins}:{secs.toString().padStart(2, "0")}
        </span>
      </div>
      {paper?.lockdown && <p className="text-xs text-slate-500 flex items-center gap-1"><Lock className="w-3 h-3" /> Lockdown mode</p>}

      {q && (
        <div className="card p-6 space-y-4">
          <p className="text-slate-400 text-sm">Question {idx + 1} of {questions.length}</p>
          <p className="text-white text-lg">{q.prompt}</p>
          {q.questionType === "mcq" && (q.optionsJson ?? []).map((opt, i) => (
            <label key={i} className="flex items-center gap-2 p-3 rounded-lg bg-slate-800/80 cursor-pointer">
              <input
                type="radio"
                name={q.id}
                checked={answers[q.id] === i}
                onChange={() => saveAnswer(q.id, i)}
              />
              <span className="text-slate-200">{opt}</span>
            </label>
          ))}
          {q.questionType === "essay" && (
            <textarea
              className="input min-h-[120px]"
              maxLength={q.maxWords ? q.maxWords * 6 : undefined}
              value={(answers[q.id] as string) ?? ""}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
              onBlur={() => saveAnswer(q.id, (answers[q.id] as string) ?? "")}
            />
          )}
        </div>
      )}

      <div className="flex justify-between">
        <button type="button" className="btn-ghost" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>Previous</button>
        {idx < questions.length - 1 ? (
          <button type="button" className="btn-primary" onClick={() => setIdx((i) => i + 1)}>Next</button>
        ) : (
          <button type="button" className="btn-primary" onClick={submit}>Submit exam</button>
        )}
      </div>
    </div>
  );
};
