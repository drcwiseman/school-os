import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, downloadPdf } from "../api/client";
import { Link } from "react-router-dom";
import { Loader2, CreditCard, MessageSquare, Bus, Download, CheckCircle, Sparkles, BookOpen, Calendar } from "lucide-react";

function formatMoney(cents: number | undefined, currency = "UGX") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(cents / 100);
}

export const PortalDashboard: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [activeChildId, setActiveChildId] = useState<string>("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payerPhone, setPayerPhone] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [payMsg, setPayMsg] = useState(searchParams.get("paid") ? "Payment initiated — thank you!" : "");
  const [tutorMsg, setTutorMsg] = useState("");
  const [tutorReply, setTutorReply] = useState("");
  const [materials, setMaterials] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [onlineClasses, setOnlineClasses] = useState<any[]>([]);
  const [schoolEvents, setSchoolEvents] = useState<any[]>([]);

  const load = async () => {
    try {
      const me = await api.get(`/s/${schoolSlug}/api/portal/me`);
      setAccount(me.account);
      const dash = await api.get(`/s/${schoolSlug}/api/portal/dashboard`);
      setData(dash.data);
      const children = dash.data?.children ?? [];
      if (children.length && !activeChildId) setActiveChildId(children[0].id);
    } catch {
      window.location.href = `/s/${schoolSlug}/portal/login`;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [schoolSlug]);

  useEffect(() => {
    if (!schoolSlug || account?.type !== "student") return;
    Promise.all([
      api.get(`/s/${schoolSlug}/api/portal/student/materials`).catch(() => ({ data: [] })),
      api.get(`/s/${schoolSlug}/api/portal/student/timetable`).catch(() => ({ data: [] })),
      api.get(`/s/${schoolSlug}/api/portal/student/online-classes`).catch(() => ({ data: [] })),
      api.get(`/s/${schoolSlug}/api/portal/student/events`).catch(() => ({ data: [] })),
    ]).then(([m, t, o, ev]) => {
      setMaterials(m.data ?? []);
      setTimetable(t.data ?? []);
      setOnlineClasses(o.data ?? []);
      setSchoolEvents(ev.data ?? []);
    });
  }, [schoolSlug, account?.type]);

  useEffect(() => {
    if (!schoolSlug || !activeChildId || account?.type !== "parent") return;
    api.get(`/s/${schoolSlug}/api/portal/messages/${activeChildId}`)
      .then((res) => setMessages(res.data ?? []))
      .catch(() => setMessages([]));
  }, [schoolSlug, activeChildId, account?.type]);

  const currency = data?.currency ?? "UGX";
  const activeChild = (data?.children ?? []).find((c: any) => c.id === activeChildId);
  const childStatements = (data?.statements ?? []).filter((i: any) => i.studentId === activeChildId);
  const childTransport = (data?.transport ?? []).find((t: any) => t.studentId === activeChildId);

  const payInvoice = async (invoiceId: string, provider: "flutterwave" | "mtn_momo" | "stripe" | "paypal" | "airtel_money") => {
    setPayingId(invoiceId);
    try {
      const res = await api.post(`/s/${schoolSlug}/api/portal/payments/initiate`, {
        invoiceId,
        provider,
        payerPhone: provider === "mtn_momo" ? payerPhone : undefined,
      });
      if (res.data?.paymentLink) {
        window.location.href = res.data.paymentLink;
      } else {
        setPayMsg(res.message ?? "Payment request sent to your phone.");
      }
    } catch (err: any) {
      setPayMsg(err.message);
    } finally {
      setPayingId(null);
    }
  };

  const sendMessage = async () => {
    if (!activeChildId || !msgBody.trim()) return;
    await api.post(`/s/${schoolSlug}/api/portal/messages`, { studentId: activeChildId, body: msgBody });
    setMsgBody("");
    const res = await api.get(`/s/${schoolSlug}/api/portal/messages/${activeChildId}`);
    setMessages(res.data ?? []);
  };

  const downloadReportCard = async (id: string) => {
    await downloadPdf(`/s/${schoolSlug}/api/portal/pdf/report-card/${id}`);
  };

  const downloadReceipt = async (id: string) => {
    await downloadPdf(`/s/${schoolSlug}/api/portal/pdf/receipt/${id}`);
  };

  const downloadInvoice = async (id: string) => {
    await downloadPdf(`/s/${schoolSlug}/api/portal/pdf/invoice/${id}`);
  };

  const logout = async () => {
    await api.post(`/s/${schoolSlug}/api/portal/logout`, {});
    window.location.href = `/s/${schoolSlug}/portal/login`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-primary-400 uppercase tracking-wider font-medium">School portal</p>
            <h1 className="text-lg font-bold text-white capitalize">{schoolSlug}</h1>
          </div>
          <button type="button" className="btn-ghost text-sm" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5 pb-12">
        <p className="text-slate-400 text-sm">{account?.email}</p>

        {payMsg && (
          <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded-lg px-4 py-3">
            <CheckCircle className="w-4 h-4 shrink-0" /> {payMsg}
          </div>
        )}

        {account?.type === "parent" && data && (
          <>
            {(data.children ?? []).length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {(data.children ?? []).map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveChildId(c.id)}
                    className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeChildId === c.id ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"}`}
                  >
                    {c.firstName} {c.lastName}
                  </button>
                ))}
              </div>
            )}

            {activeChild && (
              <div className="card p-4 border-primary-900/30">
                <p className="text-white font-semibold">{activeChild.firstName} {activeChild.lastName}</p>
                <p className="text-slate-500 text-sm">{activeChild.admissionNumber}</p>
              </div>
            )}

            <PortalCard title="Fees & payments" icon={CreditCard}>
              {childStatements.length === 0 ? (
                <p className="text-slate-500 text-sm">No invoices for this child.</p>
              ) : (
                <ul className="space-y-4">
                  {childStatements.map((i: any) => {
                    const balance = (i.totalAmount ?? 0) - (i.paidAmount ?? 0);
                    const unpaid = balance > 0;
                    return (
                      <li key={i.id} className="border border-slate-800 rounded-lg p-3">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="text-white font-medium">{i.invoiceNo}</p>
                            <p className="text-slate-400 text-sm">{formatMoney(i.totalAmount, currency)} · <span className="capitalize">{i.status}</span></p>
                            {unpaid && <p className="text-amber-400 text-sm mt-1">Due: {formatMoney(balance, currency)}</p>}
                          </div>
                          <button type="button" className="btn-ghost text-xs" onClick={() => downloadInvoice(i.id)}>
                            <Download className="w-3 h-3" /> PDF
                          </button>
                        </div>
                        {unpaid && data.paymentGatewaysEnabled && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn-primary text-xs"
                              disabled={payingId === i.id}
                              onClick={() => payInvoice(i.id, "flutterwave")}
                            >
                              Pay with card
                            </button>
                            <button type="button" className="btn-secondary text-xs" disabled={payingId === i.id} onClick={() => payInvoice(i.id, "mtn_momo")}>MTN MoMo</button>
                            <button type="button" className="btn-secondary text-xs" disabled={payingId === i.id} onClick={() => payInvoice(i.id, "stripe")}>Stripe</button>
                            <button type="button" className="btn-secondary text-xs" disabled={payingId === i.id} onClick={() => payInvoice(i.id, "paypal")}>PayPal</button>
                          </div>
                        )}
                        {unpaid && data.paymentGatewaysEnabled && payingId === i.id && (
                          <input className="input mt-2 text-sm" placeholder="MoMo phone +256…" value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </PortalCard>

            {childTransport && (
              <PortalCard title="Transport" icon={Bus}>
                <p className="text-slate-300 text-sm">Route: <strong className="text-white">{childTransport.routeName}</strong></p>
                {(childTransport.stops ?? []).length > 0 && (
                  <ol className="mt-2 text-sm text-slate-400 list-decimal list-inside">
                    {childTransport.stops.map((s: any, i: number) => <li key={i}>{s.name}</li>)}
                  </ol>
                )}
              </PortalCard>
            )}

            <PortalCard title="Chat with school" icon={MessageSquare}>
              <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                {messages.map((m) => (
                  <div key={m.id} className={`text-sm p-2 rounded-lg ${m.senderType === "parent" ? "bg-primary-900/30 ml-4" : "bg-slate-800 mr-4"}`}>
                    {m.body}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="input flex-1 text-sm" value={msgBody} onChange={(e) => setMsgBody(e.target.value)} placeholder="Message teachers…" />
                <button type="button" className="btn-primary text-sm" onClick={sendMessage}>Send</button>
              </div>
            </PortalCard>

            <PortalCard title="Report cards">
              <ul className="text-slate-300 text-sm space-y-2">
                {(data.reportCards ?? []).filter((rc: any) => rc.studentId === activeChildId).length === 0
                  ? <li>None published yet.</li>
                  : (data.reportCards ?? []).filter((rc: any) => rc.studentId === activeChildId).map((rc: any) => (
                    <li key={rc.id} className="flex justify-between">
                      <span>{new Date(rc.createdAt).toLocaleDateString()}</span>
                      <button type="button" className="btn-ghost text-xs" onClick={() => downloadReportCard(rc.id)}>PDF</button>
                    </li>
                  ))}
              </ul>
            </PortalCard>

            <PortalCard title="Receipts">
              <ul className="text-slate-300 text-sm space-y-2">
                {(data.receipts ?? []).filter((r: any) => r.studentId === activeChildId).map((r: any) => (
                  <li key={r.id} className="flex justify-between">
                    <span>{r.receiptNo} — {formatMoney(r.amount, currency)}</span>
                    <button type="button" className="btn-ghost text-xs" onClick={() => downloadReceipt(r.id)}>PDF</button>
                  </li>
                ))}
              </ul>
            </PortalCard>

            <PortalCard title="Attendance">
              <AttendanceList rows={(data.attendance ?? []).filter((r: any) => r.studentId === activeChildId)} />
            </PortalCard>

            <PortalCard title="Announcements">
              <ul className="text-slate-300 text-sm space-y-3">
                {(data.announcements ?? []).map((a: any) => (
                  <li key={a.id}><strong className="text-white block">{a.title}</strong>{a.body}</li>
                ))}
              </ul>
            </PortalCard>
          </>
        )}

        {account?.type === "student" && data && (
          <>
            <div className="card p-4">
              <p className="text-white font-semibold">{data.student?.firstName} {data.student?.lastName}</p>
              <p className="text-slate-500 text-sm">{data.student?.admissionNumber}</p>
            </div>
            {data.reportCard && (
              <PortalCard title="Report card">
                <button type="button" className="btn-ghost text-xs" onClick={() => downloadReportCard(data.reportCard.id)}>Download PDF</button>
              </PortalCard>
            )}
            <PortalCard title="Homework">
              <HomeworkPortalList
                schoolSlug={schoolSlug!}
                assignments={data.assignments ?? []}
                submissions={data.submissions ?? []}
              />
            </PortalCard>
            <PortalCard title="Attendance">
              <AttendanceList rows={data.attendance ?? []} />
            </PortalCard>
            <PortalCard title="CBT exams" icon={BookOpen}>
              <Link to={`/s/${schoolSlug}/exam`} className="btn-primary text-sm">Open exam player</Link>
            </PortalCard>
            <PortalCard title="Timetable" icon={Calendar}>
              <ul className="text-slate-300 text-sm space-y-1">
                {timetable.slice(0, 12).map((p: any) => (
                  <li key={p.id}>Period {p.periodNo ?? "—"} · {p.dayOfWeek ?? ""}</li>
                ))}
                {timetable.length === 0 && <p className="text-slate-500">No timetable published.</p>}
              </ul>
            </PortalCard>
            <PortalCard title="Study materials">
              <ul className="text-slate-300 text-sm space-y-1">
                {materials.map((m: any) => (
                  <li key={m.id}>
                    {m.title}
                    {m.filePath ? (
                      <> — <a href={`/s/${schoolSlug}/api/portal/student/materials/${m.id}/file`} className="text-primary-400" target="_blank" rel="noreferrer">download</a></>
                    ) : m.url ? (
                      <> — <a href={m.url} className="text-primary-400" target="_blank" rel="noreferrer">open</a></>
                    ) : null}
                  </li>
                ))}
              </ul>
            </PortalCard>
            <PortalCard title="Online classes">
              <ul className="text-slate-300 text-sm space-y-2">
                {onlineClasses.map((c: any) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2">
                    <a href={c.url} className="text-primary-400" target="_blank" rel="noreferrer">{c.title}</a>
                    <button
                      type="button"
                      className="text-xs btn-ghost py-0.5"
                      onClick={async () => {
                        await api.post(`/s/${schoolSlug}/api/portal/student/online-classes/${c.id}/join`, {});
                      }}
                    >
                      Mark joined
                    </button>
                  </li>
                ))}
              </ul>
            </PortalCard>
            <PortalCard title="School events" icon={Calendar}>
              <ul className="text-slate-300 text-sm space-y-1">
                {schoolEvents.map((e: any) => (
                  <li key={e.id}>
                    <strong className="text-white">{e.title}</strong>
                    <span className="text-slate-500 block text-xs capitalize">{e.eventType} · {new Date(e.startsAt).toLocaleString()}{e.venue ? ` · ${e.venue}` : ""}</span>
                  </li>
                ))}
                {!schoolEvents.length && <p className="text-slate-500">No upcoming events.</p>}
              </ul>
            </PortalCard>
            <PortalCard title="AI tutor" icon={Sparkles}>
              <textarea className="input min-h-[80px] text-sm" value={tutorMsg} onChange={(e) => setTutorMsg(e.target.value)} placeholder="Ask a study question…" />
              <button type="button" className="btn-secondary text-sm mt-2" onClick={async () => {
                const res = await api.post(`/s/${schoolSlug}/api/portal/student/tutor`, { message: tutorMsg, subject: "General" });
                setTutorReply(res.data?.reply ?? "");
              }}>Ask</button>
              {tutorReply && <p className="text-slate-300 text-sm mt-2">{tutorReply}</p>}
            </PortalCard>
          </>
        )}
      </main>
    </div>
  );
};

function PortalCard({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="card p-5 shadow-lg shadow-black/20">
      <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-primary-400" />}
        {title}
      </h2>
      {children}
    </div>
  );
}

function HomeworkPortalList({
  schoolSlug,
  assignments,
  submissions,
}: {
  schoolSlug: string;
  assignments: any[];
  submissions: any[];
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const subByAssignment = Object.fromEntries(submissions.map((s: any) => [s.assignmentId, s]));

  const submit = async (assignmentId: string) => {
    const content = drafts[assignmentId]?.trim();
    if (!content) return;
    await api.post(`/s/${schoolSlug}/api/portal/student/assignments/${assignmentId}/submit`, { content });
    window.location.reload();
  };

  if (!assignments.length) return <p className="text-slate-500 text-sm">No homework assigned.</p>;

  return (
    <ul className="text-slate-300 text-sm space-y-3">
      {assignments.map((a: any) => {
        const sub = subByAssignment[a.id];
        return (
          <li key={a.id} className="border-b border-slate-800 pb-2">
            <p className="text-white font-medium">{a.title}</p>
            <p className="text-xs text-slate-500">Due {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}</p>
            {sub ? (
              <p className="text-xs text-emerald-400 mt-1">
                Submitted · {sub.status}{sub.score != null ? ` · Score: ${sub.score}/${sub.maxScore ?? 100}` : ""}
              </p>
            ) : (
              <div className="mt-2 space-y-1">
                <textarea
                  className="input text-sm min-h-[60px]"
                  placeholder="Your answer…"
                  value={drafts[a.id] ?? ""}
                  onChange={(e) => setDrafts({ ...drafts, [a.id]: e.target.value })}
                />
                <button type="button" className="btn-primary text-xs" onClick={() => submit(a.id)}>Submit</button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AttendanceList({ rows }: { rows: any[] }) {
  if (rows.length === 0) return <p className="text-slate-400 text-sm">No records yet.</p>;
  return (
    <ul className="text-slate-300 text-sm space-y-1">
      {rows.map((r, i) => (
        <li key={i}>
          {r.date ? new Date(r.date).toLocaleDateString() : "—"} — <span className="capitalize">{r.status}</span>
        </li>
      ))}
    </ul>
  );
}
