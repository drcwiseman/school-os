import { useState } from "react";
import { api } from "../../../api/client";
import { Loader2, Sparkles } from "lucide-react";
import { useToast } from "../../../components/Toast";

export function StudentTutorPanel({ schoolSlug }: { schoolSlug: string }) {
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("General");
  const [reply, setReply] = useState("");
  const [studyPlan, setStudyPlan] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    const text = message.trim();
    if (!text) {
      toast("Type a question first", "error");
      return;
    }
    setLoading(true);
    setReply("");
    setStudyPlan([]);
    try {
      const res = await api.post(`/s/${schoolSlug}/api/portal/student/tutor`, {
        message: text,
        subject: subject.trim() || "General",
      });
      const data = res.data ?? {};
      setReply(data.reply ?? "");
      setStudyPlan(Array.isArray(data.studyPlan) ? data.studyPlan : []);
      if (data.aiDisabled) toast("AI tutor is not enabled for your school", "error");
    } catch (e: any) {
      toast(e.message ?? "Could not reach the tutor", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--portal-muted)]">
        Get study tips and explanations. This is a helper — always confirm important facts with your teachers.
      </p>
      <label className="text-xs text-[var(--portal-subtle)] block">
        Subject / topic
        <input
          className="portal-input w-full mt-1 rounded-lg text-sm"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          autoComplete="off"
          placeholder="e.g. Mathematics, English"
        />
      </label>
      <label className="text-xs text-[var(--portal-subtle)] block">
        Your question
        <textarea
          className="portal-input w-full mt-1 rounded-lg text-sm min-h-[100px]"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          autoComplete="off"
          placeholder="Ask about a topic, exam prep, or homework help…"
        />
      </label>
      <button
        type="button"
        disabled={loading}
        className="portal-btn-primary rounded-lg text-white text-sm px-4 py-2 font-medium inline-flex items-center gap-2"
        onClick={ask}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        Ask tutor
      </button>
      {reply && (
        <div className="rounded-xl border border-[var(--portal-border)] p-4 text-sm text-[var(--portal-fg)] whitespace-pre-wrap">
          {reply}
        </div>
      )}
      {studyPlan.length > 0 && (
        <div className="rounded-xl border border-[var(--portal-border)] p-4">
          <p className="text-xs font-bold uppercase tracking-wider portal-accent-text mb-2">Suggested study plan</p>
          <ul className="text-sm space-y-1 list-disc pl-4 text-[var(--portal-muted)]">
            {studyPlan.map((item, i) => (
              <li key={i}>{typeof item === "string" ? item : JSON.stringify(item)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
