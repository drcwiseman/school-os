import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { useAuth } from "../state/AuthContext";
import {
  Sparkles, Loader2, Send, AlertTriangle, DollarSign, Lightbulb,
  BookOpen, MessageSquare, BarChart3,
} from "lucide-react";

type Overview = {
  usage: { monthCredits: number; byFeature: Array<{ feature: string; credits: number }> };
  atRisk: Array<{ studentId: string; name: string; riskScore: number; status: string; guidanceRecommendation: string }>;
  feeDefault: number;
  recommendations: string[];
};

export const AiAdmin: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { moduleEnabled } = useAuth();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tab, setTab] = useState<"overview" | "assistant" | "teacher">("overview");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [lessonTopic, setLessonTopic] = useState("");
  const [lessonResult, setLessonResult] = useState("");
  const base = `/s/${schoolSlug}`;

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/ai-admin/overview`);
      setOverview(res.data);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolSlug]);

  const askAssistant = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/s/${schoolSlug}/api/ai-admin/assistant`, { message });
      setReply(res.data.reply);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setSending(false);
    }
  };

  const genLesson = async () => {
    if (!lessonTopic.trim()) return;
    try {
      const res = await api.post(`/s/${schoolSlug}/api/ai-admin/lesson-plan`, {
        subject: "General",
        className: "Mixed",
        topic: lessonTopic,
      });
      setLessonResult(res.data.content);
      toast("Lesson plan generated", "success");
      load();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  if (!moduleEnabled("ai_homework")) {
    return (
      <div className="card p-8 text-center text-slate-400">
        AI features are not enabled for this school. Contact your platform admin to add the <span className="font-mono text-slate-300">ai_homework</span> feature.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: Sparkles },
    { id: "assistant" as const, label: "Admin assistant", icon: MessageSquare },
    { id: "teacher" as const, label: "Teacher tools", icon: BookOpen },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-violet-400" />
            AI Admin
          </h1>
          <p className="text-slate-400 mt-1">Risk signals, recommendations, usage metering, and generative tools</p>
        </div>
        <Link to={`${base}/dashboard`} className="btn-secondary text-sm">Command Center</Link>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${tab === t.id ? "bg-primary-600/30 text-primary-200" : "text-slate-400 hover:text-white"}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && overview && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="card p-5 lg:col-span-2">
            <h3 className="font-semibold text-white flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> At-risk students
            </h3>
            {overview.atRisk.length === 0 ? (
              <p className="text-sm text-slate-500">No elevated risk in current sample.</p>
            ) : (
              <ul className="space-y-2">
                {overview.atRisk.map((s) => (
                  <li key={s.studentId} className="flex justify-between items-start gap-2 text-sm border-b border-slate-800/60 pb-2">
                    <div>
                      <Link to={`${base}/students/${s.studentId}`} className="text-primary-400 hover:underline">{s.name}</Link>
                      <p className="text-xs text-slate-500 mt-0.5">{s.guidanceRecommendation}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${s.status === "high" ? "bg-red-900/40 text-red-300" : "bg-amber-900/40 text-amber-300"}`}>
                      {s.riskScore}%
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-4">
            <div className="card p-5">
              <p className="text-xs text-slate-500">AI credits this month</p>
              <p className="text-2xl font-bold text-white">{overview.usage.monthCredits}</p>
              <ul className="mt-2 text-xs text-slate-400 space-y-1">
                {overview.usage.byFeature.map((f) => (
                  <li key={f.feature}>{f.feature}: {f.credits}</li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <p className="text-xs text-slate-500 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Fee default risk</p>
              <p className="text-2xl font-bold text-amber-300">{overview.feeDefault}</p>
              <p className="text-xs text-slate-500">students overdue</p>
            </div>
          </div>
          <div className="card p-5 lg:col-span-3">
            <h3 className="font-semibold text-white flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-yellow-400" /> Operational recommendations
            </h3>
            <ul className="list-disc list-inside text-sm text-slate-300 space-y-1">
              {overview.recommendations.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </div>
        </div>
      )}

      {tab === "assistant" && (
        <div className="card p-6 max-w-2xl space-y-4">
          <p className="text-sm text-slate-400">Ask about fees, attendance, at-risk students, or daily operations.</p>
          <textarea className="input min-h-[100px]" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Which students need fee follow-up?" />
          <button type="button" className="btn-primary" disabled={sending} onClick={askAssistant}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Ask</>}
          </button>
          {reply && (
            <div className="rounded-lg bg-slate-800/60 p-4 text-sm text-slate-200 border border-slate-700">{reply}</div>
          )}
        </div>
      )}

      {tab === "teacher" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-6 space-y-3">
            <h3 className="font-semibold text-white">Lesson plan generator</h3>
            <input className="input" placeholder="Topic" value={lessonTopic} onChange={(e) => setLessonTopic(e.target.value)} />
            <button type="button" className="btn-primary" onClick={genLesson}>Generate</button>
            {lessonResult && <pre className="text-xs text-slate-300 whitespace-pre-wrap max-h-64 overflow-auto">{lessonResult}</pre>}
          </div>
          <div className="card p-6">
            <h3 className="font-semibold text-white flex items-center gap-2 mb-2"><BarChart3 className="w-4 h-4" /> More tools</h3>
            <p className="text-sm text-slate-400">Quiz generation, report comments, and study plans are available via API and Teacher workspace.</p>
            <Link to={`${base}/teacher`} className="text-sm text-primary-400 mt-3 inline-block hover:underline">Open teacher workspace →</Link>
          </div>
        </div>
      )}
    </div>
  );
};
