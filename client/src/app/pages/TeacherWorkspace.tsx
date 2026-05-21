import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";
import { useToast } from "../components/Toast";
import {
  Calendar, BookOpen, UserCheck, ClipboardList, Megaphone, Loader2, Sparkles,
  MessageSquare,
} from "lucide-react";

type Tab = "overview" | "lessons" | "scheme" | "gradebook" | "cbt" | "substitute" | "performance" | "messages" | "meetings";

export const TeacherWorkspace: React.FC = () => {
  const { schoolSlug, user, moduleEnabled } = useAuth();
  const { toast } = useToast();
  const base = `/s/${schoolSlug}`;
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [ws, setWs] = useState<any>(null);
  const [lessonPlans, setLessonPlans] = useState<any[]>([]);
  const [scheme, setScheme] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [lessonForm, setLessonForm] = useState({ title: "", topic: "", subject: "", className: "" });
  const [schemeForm, setSchemeForm] = useState({ topic: "", weekNo: "1", objectives: "" });
  const [meetingForm, setMeetingForm] = useState({ title: "", scheduledAt: "", notes: "" });
  const [aiComment, setAiComment] = useState("");
  const [gradebook, setGradebook] = useState<any[]>([]);
  const [cbtPapers, setCbtPapers] = useState<any[]>([]);
  const [substitutes, setSubstitutes] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any>(null);
  const [cbtForm, setCbtForm] = useState({ title: "", durationMinutes: "60" });
  const [questionForm, setQuestionForm] = useState({ paperId: "", prompt: "", options: "A,B,C,D", correctIndex: "0" });
  const [subForm, setSubForm] = useState({ absentUserId: "", substituteUserId: "", date: "", notes: "" });

  const load = async () => {
    setLoading(true);
    try {
      const w = await api.get(`/s/${schoolSlug}/api/teacher/workspace`);
      setWs(w.data);
      const [lp, sw, mt] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/teacher/lesson-plans`),
        api.get(`/s/${schoolSlug}/api/teacher/scheme-of-work`),
        api.get(`/s/${schoolSlug}/api/teacher/meetings`),
      ]);
      setLessonPlans(lp.data ?? []);
      setScheme(sw.data ?? []);
      setMeetings(mt.data ?? []);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (schoolSlug) load(); }, [schoolSlug]);

  const loadMessages = async (studentId: string) => {
    setSelectedStudent(studentId);
    const res = await api.get(`/s/${schoolSlug}/api/teacher/messages/${studentId}`);
    setMessages(res.data ?? []);
  };

  const sendMessage = async () => {
    if (!selectedStudent || !msgBody.trim()) return;
    try {
      await api.post(`/s/${schoolSlug}/api/teacher/messages`, { studentId: selectedStudent, body: msgBody });
      setMsgBody("");
      loadMessages(selectedStudent);
      toast("Message sent", "success");
    } catch (err: any) { toast(err.message, "error"); }
  };

  const aiLesson = async () => {
    if (!moduleEnabled("ai_homework")) return toast("AI feature not enabled for this school", "error");
    try {
      const res = await api.post(`/s/${schoolSlug}/api/teacher/lesson-plans/ai-generate`, {
        topic: lessonForm.topic,
        subject: lessonForm.subject,
        className: lessonForm.className,
      });
      await api.post(`/s/${schoolSlug}/api/teacher/lesson-plans`, {
        title: res.data.title,
        content: res.data.content,
      });
      toast("AI lesson plan saved", "success");
      load();
    } catch (err: any) { toast(err.message, "error"); }
  };

  const addScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/s/${schoolSlug}/api/teacher/scheme-of-work`, {
        topic: schemeForm.topic,
        weekNo: Number(schemeForm.weekNo),
        objectives: schemeForm.objectives,
      });
      setSchemeForm({ topic: "", weekNo: "1", objectives: "" });
      load();
      toast("Scheme entry added", "success");
    } catch (err: any) { toast(err.message, "error"); }
  };

  const addMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/s/${schoolSlug}/api/teacher/meetings`, meetingForm);
      setMeetingForm({ title: "", scheduledAt: "", notes: "" });
      load();
      toast("Meeting scheduled", "success");
    } catch (err: any) { toast(err.message, "error"); }
  };

  const genComment = async () => {
    if (!moduleEnabled("ai_homework")) return toast("AI not enabled", "error");
    try {
      const res = await api.post(`/s/${schoolSlug}/api/teacher/ai/report-comment`, {
        studentName: "Student",
        averageScore: 62,
        attendanceRate: 0.88,
      });
      setAiComment(res.data.comment);
    } catch (err: any) { toast(err.message, "error"); }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const loadTab = async (t: Tab) => {
    if (t === "gradebook") setGradebook((await api.get(`/s/${schoolSlug}/api/teacher/gradebook`)).data ?? []);
    if (t === "cbt") setCbtPapers((await api.get(`/s/${schoolSlug}/api/teacher/cbt-papers`)).data ?? []);
    if (t === "substitute") setSubstitutes((await api.get(`/s/${schoolSlug}/api/teacher/substitutes`)).data ?? []);
    if (t === "performance") setPerformance((await api.get(`/s/${schoolSlug}/api/teacher/performance`)).data);
  };

  useEffect(() => { if (schoolSlug && tab !== "overview" && tab !== "lessons" && tab !== "scheme" && tab !== "messages" && tab !== "meetings") loadTab(tab); }, [tab, schoolSlug]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Today" },
    { id: "lessons", label: "Lesson plans" },
    { id: "scheme", label: "Scheme of work" },
    { id: "gradebook", label: "Gradebook" },
    { id: "cbt", label: "CBT author" },
    { id: "substitute", label: "Substitutes" },
    { id: "performance", label: "Performance" },
    { id: "messages", label: "Parent chat" },
    { id: "meetings", label: "Meetings" },
  ];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Teacher workspace</h1>
          <p className="text-slate-400 mt-1">Daily tools for {user?.firstName} — timetable, grading, lesson planning, parent messages.</p>
        </div>
        {ws?.overloaded && (
          <span className="text-xs px-3 py-1 rounded-full bg-amber-900/40 text-amber-300">High workload — {ws.myClasses?.length} class assignments</span>
        )}
      </div>

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
            <QuickLink to={`${base}/exams`} icon={ClipboardList} label="Gradebook" sub={`${ws?.draftMarks?.length ?? 0} drafts`} />
            <QuickLink to={`${base}/academics`} icon={BookOpen} label="Assignments" sub={`${ws?.upcomingAssignments?.length ?? 0} due soon`} />
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
              <ul className="flex flex-wrap gap-2">
                {(ws?.myClasses ?? []).map((c: any) => (
                  <li key={c.id} className="px-3 py-1 rounded-full bg-slate-800 text-sm text-slate-300">
                    {c.className} — {c.subjectName}
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Grading queue">
              {(ws?.gradingQueue ?? []).length === 0 ? <p className="text-sm text-slate-500">No submissions pending.</p> : (
                <ul className="text-sm text-slate-300 space-y-1">
                  {ws.gradingQueue.slice(0, 8).map((g: any) => (
                    <li key={g.submissionId}>{g.assignmentTitle} · student {g.studentId.slice(0, 8)}</li>
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
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary-400" /> AI lesson generator</h3>
            <input className="input" placeholder="Topic" value={lessonForm.topic} onChange={(e) => setLessonForm({ ...lessonForm, topic: e.target.value })} />
            <input className="input" placeholder="Subject" value={lessonForm.subject} onChange={(e) => setLessonForm({ ...lessonForm, subject: e.target.value })} />
            <input className="input" placeholder="Class name" value={lessonForm.className} onChange={(e) => setLessonForm({ ...lessonForm, className: e.target.value })} />
            <button type="button" className="btn-primary" onClick={aiLesson}>Generate & save</button>
          </div>
          <div className="card p-5">
            <h3 className="font-semibold text-white mb-3">Saved lesson plans</h3>
            <ul className="text-sm text-slate-300 space-y-2">
              {lessonPlans.map((lp) => (
                <li key={lp.id}><strong>{lp.title}</strong><p className="text-slate-500 line-clamp-2">{lp.content?.slice(0, 120)}</p></li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {tab === "scheme" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={addScheme} className="card p-5 space-y-3">
            <h3 className="font-semibold text-white">Scheme of work</h3>
            <input className="input" placeholder="Week" type="number" value={schemeForm.weekNo} onChange={(e) => setSchemeForm({ ...schemeForm, weekNo: e.target.value })} />
            <input className="input" placeholder="Topic" required value={schemeForm.topic} onChange={(e) => setSchemeForm({ ...schemeForm, topic: e.target.value })} />
            <textarea className="input min-h-[80px]" placeholder="Objectives" value={schemeForm.objectives} onChange={(e) => setSchemeForm({ ...schemeForm, objectives: e.target.value })} />
            <button type="submit" className="btn-primary">Add week</button>
          </form>
          <div className="card p-5">
            <ul className="text-sm text-slate-300 space-y-2">
              {scheme.map((s) => (
                <li key={s.id}>W{s.weekNo}: <strong>{s.topic}</strong> — {s.objectives?.slice(0, 60)}</li>
              ))}
            </ul>
          </div>
        </div>
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
          <div className="card p-5">
            <h3 className="font-semibold text-white mb-3">Draft marks</h3>
            <ul className="text-sm text-slate-300 space-y-1">
              {(ws?.draftMarks ?? []).map((m: any) => (
                <li key={m.markId}>{m.assessmentName} — score {m.score ?? "—"}</li>
              ))}
            </ul>
          </div>
          <div className="card p-5 space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2"><Sparkles className="w-4 h-4" /> Report comment AI</h3>
            <button type="button" className="btn-secondary" onClick={genComment}>Generate sample comment</button>
            {aiComment && <p className="text-sm text-slate-300 border border-slate-700 rounded-lg p-3">{aiComment}</p>}
          </div>
        </div>
      )}

      {tab === "cbt" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <form className="card p-5 space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            await api.post(`/s/${schoolSlug}/api/teacher/cbt-papers`, { title: cbtForm.title, durationMinutes: Number(cbtForm.durationMinutes) });
            toast("CBT paper created", "success");
            loadTab("cbt");
          }}>
            <h3 className="font-semibold text-white">CBT paper</h3>
            <input className="input" placeholder="Title" required value={cbtForm.title} onChange={(e) => setCbtForm({ ...cbtForm, title: e.target.value })} />
            <input className="input" type="number" placeholder="Duration (min)" value={cbtForm.durationMinutes} onChange={(e) => setCbtForm({ ...cbtForm, durationMinutes: e.target.value })} />
            <button type="submit" className="btn-primary">Create paper</button>
          </form>
          <form className="card p-5 space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            await api.post(`/s/${schoolSlug}/api/teacher/cbt-papers/${questionForm.paperId}/questions`, {
              prompt: questionForm.prompt,
              options: questionForm.options.split(","),
              correctIndex: Number(questionForm.correctIndex),
            });
            toast("Question added", "success");
          }}>
            <h3 className="font-semibold text-white">Add MCQ</h3>
            <input className="input" placeholder="Paper UUID" required value={questionForm.paperId} onChange={(e) => setQuestionForm({ ...questionForm, paperId: e.target.value })} />
            <input className="input" placeholder="Question" required value={questionForm.prompt} onChange={(e) => setQuestionForm({ ...questionForm, prompt: e.target.value })} />
            <input className="input" placeholder="Options comma-separated" value={questionForm.options} onChange={(e) => setQuestionForm({ ...questionForm, options: e.target.value })} />
            <button type="submit" className="btn-secondary">Add question</button>
          </form>
          <div className="card p-5 lg:col-span-2 text-sm text-slate-300">{cbtPapers.map((p) => <p key={p.id}>{p.title} — {p.durationMinutes} min</p>)}</div>
        </div>
      )}

      {tab === "substitute" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <form className="card p-5 space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            await api.post(`/s/${schoolSlug}/api/teacher/substitutes`, subForm);
            toast("Substitute scheduled", "success");
            loadTab("substitute");
          }}>
            <h3 className="font-semibold text-white">Substitute teacher</h3>
            <input className="input" placeholder="Absent user UUID" required value={subForm.absentUserId} onChange={(e) => setSubForm({ ...subForm, absentUserId: e.target.value })} />
            <input className="input" placeholder="Substitute user UUID" required value={subForm.substituteUserId} onChange={(e) => setSubForm({ ...subForm, substituteUserId: e.target.value })} />
            <input className="input" type="date" required value={subForm.date} onChange={(e) => setSubForm({ ...subForm, date: e.target.value })} />
            <button type="submit" className="btn-primary">Schedule</button>
          </form>
          <div className="card p-5 text-sm text-slate-300">{substitutes.map((s) => <p key={s.id}>{s.date}: sub {s.substituteUserId?.slice(0, 8)}</p>)}</div>
        </div>
      )}

      {tab === "performance" && performance && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card p-5 text-center"><p className="text-2xl font-bold text-white">{performance.classCount}</p><p className="text-xs text-slate-500">Classes</p></div>
          <div className="card p-5 text-center"><p className="text-2xl font-bold text-white">{performance.marksEntered}</p><p className="text-xs text-slate-500">Marks entered</p></div>
          <div className="card p-5 text-center"><p className="text-2xl font-bold text-white">{performance.lessonPlans}</p><p className="text-xs text-slate-500">Lesson plans</p></div>
        </div>
      )}

      {tab === "messages" && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="card p-4 lg:col-span-1">
            <h3 className="font-semibold text-white mb-2 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Students</h3>
            <p className="text-xs text-slate-500 mb-2">Enter student UUID from Students module</p>
            <input className="input text-sm" placeholder="Student UUID" value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)} />
            <button type="button" className="btn-ghost mt-2 w-full text-sm" onClick={() => selectedStudent && loadMessages(selectedStudent)}>Load thread</button>
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
              <button type="button" className="btn-primary" onClick={sendMessage}>Send</button>
            </div>
          </div>
        </div>
      )}

      {tab === "meetings" && (
        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={addMeeting} className="card p-5 space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2"><Calendar className="w-4 h-4" /> Meetings</h3>
            <input className="input" placeholder="Title" required value={meetingForm.title} onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })} />
            <input className="input" type="datetime-local" required value={meetingForm.scheduledAt} onChange={(e) => setMeetingForm({ ...meetingForm, scheduledAt: e.target.value })} />
            <textarea className="input" placeholder="Notes" value={meetingForm.notes} onChange={(e) => setMeetingForm({ ...meetingForm, notes: e.target.value })} />
            <button type="submit" className="btn-primary">Schedule</button>
          </form>
          <div className="card p-5">
            <ul className="text-sm text-slate-300 space-y-2">
              {meetings.map((m) => (
                <li key={m.id}><strong>{m.title}</strong> — {new Date(m.scheduledAt).toLocaleString()}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

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
