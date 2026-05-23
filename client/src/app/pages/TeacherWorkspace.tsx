import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { useToast } from "../components/Toast";
import {
  BookOpen, UserCheck, ClipboardList, Megaphone, Loader2, Sparkles, MessageSquare,
} from "lucide-react";
import { TeacherSimpleCrud } from "./teacher/TeacherSimpleCrud";

type Tab = "overview" | "lessons" | "scheme" | "gradebook" | "cbt" | "substitute" | "performance" | "messages" | "meetings";

type LessonPlan = { id: string; title: string; content?: string; weekNo?: number; updatedAt?: string };
type SchemeRow = { id: string; weekNo: number; topic: string; objectives?: string };
type Meeting = { id: string; title: string; scheduledAt: string; notes?: string };
type CbtPaper = { id: string; title: string; durationMinutes?: number; published?: boolean };
type CbtQuestion = { id: string; prompt: string; optionsJson?: string[] };
type Substitute = { id: string; date: string; absentUserId: string; substituteUserId: string; notes?: string };
type Colleague = { userId: string; firstName: string; lastName: string; employeeNo?: string };
type Recipient = { studentId: string; studentName: string; className?: string };
type MyClass = { classId: string; className: string; subjectName?: string };

export const TeacherWorkspace: React.FC = () => {
  const { schoolSlug, user, moduleEnabled } = useAuth();
  const { toast } = useToast();
  const base = `/s/${schoolSlug}`;
  const apiBase = `/s/${schoolSlug}/api/teacher`;

  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [ws, setWs] = useState<any>(null);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [scheme, setScheme] = useState<SchemeRow[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [cbtPapers, setCbtPapers] = useState<CbtPaper[]>([]);
  const [substitutes, setSubstitutes] = useState<Substitute[]>([]);
  const [gradebook, setGradebook] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any>(null);
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [myClasses, setMyClasses] = useState<MyClass[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [msgBody, setMsgBody] = useState("");
  const [selectedPaper, setSelectedPaper] = useState("");
  const [paperQuestions, setPaperQuestions] = useState<CbtQuestion[]>([]);
  const [subAbsent, setSubAbsent] = useState("");
  const [subCover, setSubCover] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!schoolSlug) return;
    setLoading(true);
    setApiError(null);
    try {
      const [w, lp, sw, mt, meta] = await Promise.all([
        api.get(`${apiBase}/workspace`),
        api.get(`${apiBase}/lesson-plans`),
        api.get(`${apiBase}/scheme-of-work`),
        api.get(`${apiBase}/meetings`),
        Promise.all([
          api.get(`${apiBase}/colleagues`).catch(() => ({ data: [] })),
          api.get(`${apiBase}/my-classes`).catch(() => ({ data: [] })),
          api.get(`${apiBase}/messages/recipients`).catch(() => ({ data: [] })),
        ]),
      ]);
      setWs(w.data ?? null);
      setLessonPlans(lp.data ?? []);
      setScheme(sw.data ?? []);
      setMeetings(mt.data ?? []);
      setColleagues(meta[0].data ?? []);
      setMyClasses(meta[1].data ?? []);
      setRecipients(meta[2].data ?? []);
      if (user?.id) setSubAbsent(user.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not load workspace";
      setApiError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, apiBase, toast, user?.id]);

  useEffect(() => { void reload(); }, [reload]);

  const loadTab = useCallback(async (t: Tab) => {
    if (!schoolSlug) return;
    try {
      if (t === "gradebook") setGradebook((await api.get(`${apiBase}/gradebook`)).data ?? []);
      if (t === "cbt") setCbtPapers((await api.get(`${apiBase}/cbt-papers`)).data ?? []);
      if (t === "substitute") setSubstitutes((await api.get(`${apiBase}/substitutes`)).data ?? []);
      if (t === "performance") setPerformance((await api.get(`${apiBase}/performance`)).data);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Load failed", "error");
    }
  }, [schoolSlug, apiBase, toast]);

  useEffect(() => {
    if (!schoolSlug || loading) return;
    if (!["overview", "lessons", "scheme", "messages", "meetings"].includes(tab)) {
      void loadTab(tab);
    }
  }, [tab, schoolSlug, loading, loadTab]);

  const loadPaperQuestions = async (paperId: string) => {
    setSelectedPaper(paperId);
    const res = await api.get(`${apiBase}/cbt-papers/${paperId}/questions`);
    setPaperQuestions(res.data ?? []);
  };

  const loadMessages = async (studentId: string) => {
    setSelectedStudent(studentId);
    const res = await api.get(`${apiBase}/messages/${studentId}`);
    setMessages(res.data ?? []);
  };

  const sendMessage = async () => {
    if (!selectedStudent || !msgBody.trim()) return;
    try {
      await api.post(`${apiBase}/messages`, { studentId: selectedStudent, body: msgBody });
      setMsgBody("");
      await loadMessages(selectedStudent);
      toast("Message sent", "success");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Send failed", "error");
    }
  };

  const colleagueName = (id: string) => {
    const c = colleagues.find((x) => x.userId === id);
    return c ? `${c.firstName} ${c.lastName}` : id.slice(0, 8);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Today" },
    { id: "lessons", label: "Lesson plans" },
    { id: "scheme", label: "Scheme of work" },
    { id: "gradebook", label: "Gradebook" },
    { id: "cbt", label: "CBT papers" },
    { id: "substitute", label: "Substitutes" },
    { id: "performance", label: "Performance" },
    { id: "messages", label: "Parent chat" },
    { id: "meetings", label: "Meetings" },
  ];

  return (
    <div className="space-y-6 relative pb-10">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60 rounded-xl">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      )}

      {apiError && (
        <div className="card p-4 border border-red-900/50 text-sm text-slate-300">
          {apiError}. Ask admin to assign you to classes (Academics → teacher assignments) and restart the server after deploy.
        </div>
      )}

      <header className="page-header">
        <div>
          <h1 className="page-title">My workspace</h1>
          <p className="text-slate-400 mt-1">Daily teaching tools for {user?.firstName} — attendance, lessons, marks, parent messages.</p>
        </div>
        {myClasses.length === 0 && !loading && (
          <span className="text-xs px-3 py-1 rounded-full bg-amber-900/40 text-amber-200">No class assignments yet</span>
        )}
      </header>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm ${tab === t.id ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`}>
            {t.label}
            {t.id === "messages" && ws?.unreadParentMessages > 0 && (
              <span className="ml-1 text-xs bg-red-600 text-white px-1.5 rounded-full">{ws.unreadParentMessages}</span>
            )}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickLink to={`${base}/attendance`} icon={UserCheck} label="Attendance" sub="Take register" />
            <QuickLink to={`${base}/exams`} icon={ClipboardList} label="Enter marks" sub={`${ws?.draftMarks?.length ?? 0} drafts`} />
            <QuickLink to={`${base}/academics`} icon={BookOpen} label="Homework" sub={`${ws?.upcomingAssignments?.length ?? 0} due soon`} />
            <QuickLink to={`${base}/messaging`} icon={Megaphone} label="Announcements" sub="School notices" />
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <Card title="Lessons today">
              {(ws?.periodsToday ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No periods on your timetable for today.</p>
              ) : (
                <ul className="space-y-2 text-sm text-slate-300">
                  {ws.periodsToday.map((p: any) => (
                    <li key={p.id} className="flex justify-between">
                      <span>P{p.periodNo} · {p.subjectName ?? "—"} · {p.className}</span>
                      <span className="text-slate-500">{p.startTime ?? ""}{p.endTime ? `–${p.endTime}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="My classes">
              {myClasses.length === 0 ? <p className="text-sm text-slate-500">Admin must assign you in Academics.</p> : (
                <ul className="flex flex-wrap gap-2">
                  {myClasses.map((c) => (
                    <li key={`${c.classId}-${c.subjectName}`} className="px-3 py-1 rounded-full bg-slate-800 text-sm text-slate-300">
                      {c.className}{c.subjectName ? ` — ${c.subjectName}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Grading queue">
              {(ws?.gradingQueue ?? []).length === 0 ? <p className="text-sm text-slate-500">No submissions pending.</p> : (
                <ul className="text-sm text-slate-300 space-y-1">
                  {ws.gradingQueue.slice(0, 8).map((g: any) => (
                    <li key={g.submissionId}>{g.assignmentTitle}</li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Announcements">
              <ul className="text-sm text-slate-300 space-y-1">
                {(ws?.announcements ?? []).map((a: any) => (
                  <li key={a.id}><strong className="text-white">{a.title}</strong></li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}

      {tab === "lessons" && (
        <div className="space-y-4">
          {moduleEnabled("ai_homework") && (
            <div className="card p-4 flex flex-wrap gap-2 items-end">
              <p className="text-sm text-slate-400 w-full flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary-400" /> AI draft (optional)</p>
              <AiLessonDraft apiBase={apiBase} onSaved={reload} />
            </div>
          )}
          <TeacherSimpleCrud<LessonPlan>
            title="Your lesson plans"
            items={lessonPlans}
            loading={loading}
            emptyMessage="Add your first lesson plan."
            columns={[
              { key: "title", label: "Title" },
              { key: "weekNo", label: "Week" },
              { key: "content", label: "Preview", render: (r) => <span className="line-clamp-1 text-slate-400">{r.content?.slice(0, 60)}</span> },
            ]}
            fields={[
              { name: "title", label: "Title", required: true },
              { name: "weekNo", label: "Week number", type: "number" },
              { name: "content", label: "Content", type: "textarea" },
            ]}
            onCreate={async (body) => {
              await api.post(`${apiBase}/lesson-plans`, body);
              toast("Lesson plan saved", "success");
              await reload();
            }}
            onUpdate={async (id, body) => {
              await api.patch(`${apiBase}/lesson-plans/${id}`, body);
              toast("Updated", "success");
              await reload();
            }}
            onDelete={async (id) => {
              await api.delete(`${apiBase}/lesson-plans/${id}`);
              toast("Removed", "success");
              await reload();
            }}
          />
        </div>
      )}

      {tab === "scheme" && (
        <TeacherSimpleCrud<SchemeRow>
          title="Scheme of work"
          items={scheme}
          loading={loading}
          columns={[
            { key: "weekNo", label: "Week" },
            { key: "topic", label: "Topic" },
            { key: "objectives", label: "Objectives" },
          ]}
          fields={[
            { name: "weekNo", label: "Week", type: "number", required: true },
            { name: "topic", label: "Topic", required: true },
            { name: "objectives", label: "Objectives", type: "textarea" },
          ]}
          onCreate={async (body) => {
            await api.post(`${apiBase}/scheme-of-work`, body);
            toast("Added", "success");
            await reload();
          }}
          onUpdate={async (id, body) => {
            await api.patch(`${apiBase}/scheme-of-work/${id}`, body);
            toast("Updated", "success");
            await reload();
          }}
          onDelete={async (id) => {
            await api.delete(`${apiBase}/scheme-of-work/${id}`);
            toast("Removed", "success");
            await reload();
          }}
        />
      )}

      {tab === "meetings" && (
        <TeacherSimpleCrud<Meeting>
          title="Meetings & appointments"
          items={meetings}
          loading={loading}
          columns={[
            { key: "title", label: "Title" },
            { key: "scheduledAt", label: "When", render: (r) => new Date(r.scheduledAt).toLocaleString() },
            { key: "notes", label: "Notes" },
          ]}
          fields={[
            { name: "title", label: "Title", required: true },
            { name: "scheduledAt", label: "Date & time", type: "datetime-local", required: true },
            { name: "notes", label: "Notes", type: "textarea" },
          ]}
          onCreate={async (body) => {
            await api.post(`${apiBase}/meetings`, body);
            toast("Scheduled", "success");
            await reload();
          }}
          onUpdate={async (id, body) => {
            await api.patch(`${apiBase}/meetings/${id}`, body);
            toast("Updated", "success");
            await reload();
          }}
          onDelete={async (id) => {
            await api.delete(`${apiBase}/meetings/${id}`);
            toast("Removed", "success");
            await reload();
          }}
        />
      )}

      {tab === "gradebook" && (
        <div className="space-y-4">
          <Link to={`${base}/exams`} className="btn-primary inline-flex">Open marks entry →</Link>
          <div className="card p-5">
            <h3 className="font-semibold text-white mb-3">Your assessments</h3>
            <ul className="text-sm text-slate-300 space-y-1">
              {gradebook.map((g: any) => <li key={g.id}>{g.className} · {g.subjectName} — {g.name}</li>)}
            </ul>
          </div>
        </div>
      )}

      {tab === "cbt" && (
        <div className="space-y-6">
          <TeacherSimpleCrud<CbtPaper>
            title="CBT exam papers"
            items={cbtPapers}
            columns={[
              { key: "title", label: "Title" },
              { key: "durationMinutes", label: "Minutes" },
              { key: "published", label: "Published", render: (r) => (r.published ? "Yes" : "Draft") },
            ]}
            fields={[
              { name: "title", label: "Title", required: true },
              { name: "durationMinutes", label: "Duration (minutes)", type: "number" },
            ]}
            onCreate={async (body) => {
              await api.post(`${apiBase}/cbt-papers`, body);
              toast("Paper created", "success");
              await loadTab("cbt");
            }}
            onUpdate={async (id, body) => {
              await api.patch(`${apiBase}/cbt-papers/${id}`, body);
              toast("Updated", "success");
              await loadTab("cbt");
            }}
            onDelete={async (id) => {
              await api.delete(`${apiBase}/cbt-papers/${id}`);
              toast("Removed", "success");
              await loadTab("cbt");
            }}
          />
          {cbtPapers.length > 0 && (
            <div className="card p-4 space-y-3">
              <label className="label">Questions for paper</label>
              <select className="input" value={selectedPaper} onChange={(e) => void loadPaperQuestions(e.target.value)}>
                <option value="">Select paper…</option>
                {cbtPapers.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              {selectedPaper && (
                <CbtQuestionForm
                  paperId={selectedPaper}
                  apiBase={apiBase}
                  questions={paperQuestions}
                  onSaved={() => void loadPaperQuestions(selectedPaper)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {tab === "substitute" && (
        <TeacherSimpleCrud<Substitute>
          title="Substitute requests"
          items={substitutes}
          columns={[
            { key: "date", label: "Date" },
            { key: "absentUserId", label: "Absent", render: (r) => colleagueName(r.absentUserId) },
            { key: "substituteUserId", label: "Cover", render: (r) => colleagueName(r.substituteUserId) },
            { key: "notes", label: "Notes" },
          ]}
          fields={[
            { name: "date", label: "Date", type: "date", required: true },
            { name: "notes", label: "Notes", type: "textarea" },
          ]}
          extraForm={
            <ColleaguePickers colleagues={colleagues} absentId={subAbsent} coverId={subCover} onAbsent={setSubAbsent} onCover={setSubCover} />
          }
          onCreate={async (body) => {
            if (!subAbsent || !subCover) {
              toast("Pick absent and substitute teachers", "error");
              return;
            }
            await api.post(`${apiBase}/substitutes`, { ...body, absentUserId: subAbsent, substituteUserId: subCover });
            toast("Request saved", "success");
            await loadTab("substitute");
          }}
          onUpdate={async () => { toast("Edit substitute via delete and re-add", "error"); }}
          onDelete={async (id) => {
            await api.delete(`${apiBase}/substitutes/${id}`);
            toast("Removed", "success");
            await loadTab("substitute");
          }}
        />
      )}

      {tab === "performance" && performance && (
        <div className="grid grid-cols-3 gap-4">
          <Stat n={performance.classCount} label="Classes" />
          <Stat n={performance.marksEntered} label="Marks entered" />
          <Stat n={performance.lessonPlans} label="Lesson plans" />
        </div>
      )}

      {tab === "messages" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="card p-4 lg:col-span-1">
            <h3 className="font-semibold text-white mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Students</h3>
            <select className="input text-sm" value={selectedStudent} onChange={(e) => void loadMessages(e.target.value)}>
              <option value="">Select student…</option>
              {recipients.map((r) => (
                <option key={r.studentId} value={r.studentId}>{r.studentName}{r.className ? ` (${r.className})` : ""}</option>
              ))}
            </select>
          </div>
          <div className="card p-4 lg:col-span-2 flex flex-col min-h-[320px]">
            <div className="flex-1 space-y-2 overflow-y-auto mb-3">
              {messages.map((m) => (
                <div key={m.id} className={`text-sm p-2 rounded-lg max-w-[85%] ${m.senderType === "staff" ? "bg-primary-900/40 ml-auto text-slate-200" : "bg-slate-800 text-slate-300"}`}>
                  {m.body}
                  <p className="text-xs text-slate-500 mt-1">{new Date(m.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="input flex-1" value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="Message parent…" />
              <button type="button" className="btn-primary" onClick={() => void sendMessage()}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function AiLessonDraft({ apiBase, onSaved }: { apiBase: string; onSaved: () => void }) {
  const { toast } = useToast();
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [className, setClassName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input className="input flex-1 min-w-[120px]" placeholder="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
      <input className="input flex-1 min-w-[120px]" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <input className="input flex-1 min-w-[120px]" placeholder="Class" value={className} onChange={(e) => setClassName(e.target.value)} />
      <button type="button" className="btn-secondary" disabled={busy} onClick={async () => {
        setBusy(true);
        try {
          const res = await api.post(`${apiBase}/lesson-plans/ai-generate`, { topic, subject, className });
          await api.post(`${apiBase}/lesson-plans`, { title: res.data.title, content: res.data.content });
          toast("AI lesson saved", "success");
          onSaved();
        } catch (e: unknown) {
          toast(e instanceof Error ? e.message : "AI failed", "error");
        } finally { setBusy(false); }
      }}>Generate & save</button>
    </>
  );
}

function CbtQuestionForm({ paperId, apiBase, questions, onSaved }: { paperId: string; apiBase: string; questions: CbtQuestion[]; onSaved: () => void }) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState("A,B,C,D");
  const [correctIndex, setCorrectIndex] = useState("0");
  return (
    <div className="space-y-3">
      <ul className="text-sm text-slate-400 space-y-1">
        {questions.map((q) => <li key={q.id}>• {q.prompt}</li>)}
      </ul>
      <input className="input" placeholder="Question" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <input className="input" placeholder="Options (comma-separated)" value={options} onChange={(e) => setOptions(e.target.value)} />
      <input className="input w-24" type="number" placeholder="Correct index" value={correctIndex} onChange={(e) => setCorrectIndex(e.target.value)} />
      <button type="button" className="btn-secondary" onClick={async () => {
        await api.post(`${apiBase}/cbt-papers/${paperId}/questions`, {
          prompt,
          options: options.split(",").map((s) => s.trim()),
          correctIndex: Number(correctIndex),
        });
        setPrompt("");
        toast("Question added", "success");
        onSaved();
      }}>Add question</button>
    </div>
  );
}

function ColleaguePickers({
  colleagues,
  absentId,
  coverId,
  onAbsent,
  onCover,
}: {
  colleagues: Colleague[];
  absentId: string;
  coverId: string;
  onAbsent: (id: string) => void;
  onCover: (id: string) => void;
}) {
  return (
    <>
      <div>
        <label className="label">Absent teacher</label>
        <select className="input" value={absentId} onChange={(e) => onAbsent(e.target.value)}>
          {colleagues.map((c) => (
            <option key={c.userId} value={c.userId}>{c.firstName} {c.lastName}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Substitute teacher</label>
        <select className="input" value={coverId} onChange={(e) => onCover(e.target.value)}>
          {colleagues.map((c) => (
            <option key={c.userId} value={c.userId}>{c.firstName} {c.lastName}</option>
          ))}
        </select>
      </div>
    </>
  );
}

function QuickLink({ to, icon: Icon, label, sub }: { to: string; icon: React.ElementType; label: string; sub: string }) {
  return (
    <Link to={to} className="card p-4 hover:border-slate-600 transition-colors">
      <Icon className="w-5 h-5 text-primary-400 mb-2" />
      <p className="font-medium text-white">{label}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </Link>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-white mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="card p-5 text-center">
      <p className="text-2xl font-bold text-white">{n}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
