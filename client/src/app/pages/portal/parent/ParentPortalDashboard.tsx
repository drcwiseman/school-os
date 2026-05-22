import React, { useEffect, useMemo, useState } from "react";
import { api, downloadPdf } from "../../../api/client";
import {
  LayoutDashboard,
  GraduationCap,
  Wallet,
  FolderOpen,
  MessageCircle,
  Settings2,
  LogOut,
  Bell,
  Bus,
  ShieldAlert,
  DoorOpen,
  HeartPulse,
  Download,
  CreditCard,
  CheckCircle,
  CalendarOff,
  ChevronRight,
  UserCheck,
  Mail,
  Calendar,
  Users,
  Trophy,
  MapPin,
  X,
  UserCircle,
  Menu,
} from "lucide-react";
import { applyPortalTheme, getStoredPortalTheme } from "../../../utils/theme";
import { ParentPortalProfile } from "./ParentPortalProfile";

type TabId = "overview" | "attendance" | "academics" | "fees" | "records" | "messages" | "calendar" | "family" | "manage" | "profile";
type PortalTheme = "light" | "dark";

const READ_NOTIF_KEY = "portal_notif_read";

function formatMoney(cents: number | undefined, currency = "UGX") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(cents / 100);
}

function initials(first?: string, last?: string) {
  return `${(first ?? "?")[0]}${(last ?? "")[0] ?? ""}`.toUpperCase();
}

function statusPill(status: string) {
  const s = status.toLowerCase();
  const map: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    rejected: "bg-red-500/15 text-red-300 border-red-500/30",
    active: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    present: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    absent: "bg-red-500/15 text-red-300 border-red-500/30",
    minor: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    major: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  };
  return map[s] ?? "bg-slate-700/50 text-slate-300 border-slate-600";
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Home", icon: LayoutDashboard },
  { id: "attendance", label: "Attendance", icon: UserCheck },
  { id: "academics", label: "Results", icon: GraduationCap },
  { id: "fees", label: "Fees", icon: Wallet },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "family", label: "Family", icon: Users },
  { id: "records", label: "Records", icon: FolderOpen },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "manage", label: "Manage", icon: Settings2 },
  { id: "profile", label: "Profile", icon: UserCircle },
];

export const ParentPortalDashboard: React.FC<{
  schoolSlug: string;
  account: { email: string };
  data: any;
  summary: any;
  onLogout: () => void;
  payMsg: string;
  initialTheme?: PortalTheme;
  onAccountEmailChange?: (email: string) => void;
}> = ({ schoolSlug, account, data, summary, onLogout, payMsg, initialTheme, onAccountEmailChange }) => {
  const [tab, setTab] = useState<TabId>("overview");
  const [activeChildId, setActiveChildId] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [msgBody, setMsgBody] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payerPhone, setPayerPhone] = useState("");
  const [localPayMsg, setLocalPayMsg] = useState(payMsg);
  const [notifOpen, setNotifOpen] = useState(false);
  const [attendanceScope, setAttendanceScope] = useState<"term" | "all">("term");
  const [portalTheme, setPortalTheme] = useState<PortalTheme>(
    () => initialTheme ?? getStoredPortalTheme(schoolSlug),
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    applyPortalTheme(portalTheme, schoolSlug);
  }, [portalTheme, schoolSlug]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [tab]);

  const selectTab = (id: TabId) => {
    setTab(id);
    setMobileNavOpen(false);
  };
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`${READ_NOTIF_KEY}-${schoolSlug}`) ?? "[]");
    } catch {
      return [];
    }
  });

  const currency = data?.currency ?? "UGX";
  const children = data?.children ?? [];
  const notifications: any[] = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !readNotifIds.includes(n.id)).length;

  useEffect(() => {
    if (children.length && !activeChildId) setActiveChildId(children[0].id);
  }, [children, activeChildId]);

  useEffect(() => {
    if (!schoolSlug || !activeChildId) return;
    api.get(`/s/${schoolSlug}/api/portal/messages/${activeChildId}`)
      .then((res) => setMessages(res.data ?? []))
      .catch(() => setMessages([]));
  }, [schoolSlug, activeChildId]);

  const activeChild = children.find((c: any) => c.id === activeChildId);
  const enrollment = (data?.enrollments ?? []).find((e: any) => e.studentId === activeChildId);
  const currentTerm = data?.currentTerm;
  const academicYear = data?.currentAcademicYear;

  const filterChild = <T extends { studentId?: string }>(rows: T[]) =>
    rows.filter((r) => r.studentId === activeChildId);

  const childFeeTerms = (data?.feeByStudent ?? {})[activeChildId] ?? data?.feeByTerm ?? [];
  const childFamily = (data?.familyByStudent ?? {})[activeChildId] ?? [];
  const childEmergency = (data?.emergencyByStudent ?? {})[activeChildId];
  const childResultsByTerm = filterChild(data?.reportCardsByTerm ?? []);
  const calendar = data?.calendar ?? { upcoming: [], games: [], trips: [], academic: [], all: [] };

  const markNotifRead = (id: string) => {
    const next = [...new Set([...readNotifIds, id])];
    setReadNotifIds(next);
    localStorage.setItem(`${READ_NOTIF_KEY}-${schoolSlug}`, JSON.stringify(next));
    if (id.startsWith("msg-")) {
      api.patch(`/s/${schoolSlug}/api/portal/messages/${id.replace("msg-", "")}/read`, {}).catch(() => {});
    }
  };

  const openNotif = (n: any) => {
    markNotifRead(n.id);
    if (n.linkTab) selectTab(n.linkTab as TabId);
    if (n.studentId) setActiveChildId(n.studentId);
    setNotifOpen(false);
  };

  const childStatements = filterChild(data?.statements ?? []);
  const childClassAttendance: any[] = (data?.classAttendanceByStudent ?? {})[activeChildId]
    ?? filterChild(data?.attendance ?? []);
  const childAttendanceFiltered = attendanceScope === "term"
    ? childClassAttendance.filter((a: any) => a.inCurrentTerm === true)
    : childClassAttendance;
  const childSchoolTermFees: any[] = (data?.schoolTermFeesByStudent ?? {})[activeChildId] ?? [];
  const currentTermSchoolFees = childSchoolTermFees.find((f: any) => f.isCurrent)
    ?? childSchoolTermFees[0];
  const currentTermInvoice = childFeeTerms.find((f: any) => f.termId === currentTerm?.id);
  const childReceipts = filterChild(data?.receipts ?? []);
  const childLeaves = filterChild(data?.leaves ?? []);
  const childGatePasses = filterChild(data?.gatePasses ?? []);
  const childDiscipline = filterChild(data?.discipline ?? []);
  const childSickbay = filterChild(data?.sickbay ?? []);
  const childTransport = (data?.transport ?? []).find((t: any) => t.studentId === activeChildId);

  const attendanceRate = useMemo(() => {
    const rows = childClassAttendance.filter((a: any) => a.inCurrentTerm === true);
    const present = rows.filter((a: any) => a.status === "present").length;
    const total = rows.length;
    if (!total) return null;
    return Math.round((present / total) * 100);
  }, [childClassAttendance]);

  const payInvoice = async (invoiceId: string, provider: "flutterwave" | "mtn_momo" | "paypal" | "pesapal") => {
    setPayingId(invoiceId);
    try {
      const res = await api.post(`/s/${schoolSlug}/api/portal/payments/initiate`, {
        invoiceId,
        provider,
        payerPhone: provider === "mtn_momo" ? payerPhone : undefined,
      });
      if (res.data?.paymentLink) window.location.href = res.data.paymentLink;
      else setLocalPayMsg(res.message ?? "Payment request sent.");
    } catch (err: any) {
      setLocalPayMsg(err.message);
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

  const submitLeave = async (form: { startDate: string; endDate: string; reason: string }) => {
    await api.post(`/s/${schoolSlug}/api/portal/leaves`, { ...form, studentId: activeChildId });
    window.location.reload();
  };

  return (
    <div className="portal-shell min-h-screen" data-portal-theme={portalTheme}>
      {mobileNavOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <header className="portal-header sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              className="portal-mobile-menu-btn lg:hidden shrink-0 rounded-lg border p-2"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-teal-500 font-semibold">Parent portal</p>
              <h1 className="text-base sm:text-lg font-bold truncate capitalize text-[var(--portal-fg-strong)]">{schoolSlug?.replace(/-/g, " ")}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="relative rounded-lg border border-[var(--portal-border)] p-2 text-[var(--portal-muted)] hover:bg-[var(--portal-bg-muted)]"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-teal-500 text-[10px] font-bold text-white flex items-center justify-center px-1">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => selectTab("profile")}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[var(--portal-border)] px-3 py-1.5 text-xs text-[var(--portal-muted)] hover:bg-[var(--portal-bg-muted)]"
            >
              <UserCircle className="w-3.5 h-3.5" /> Profile
            </button>
            <span className="hidden md:inline text-xs text-[var(--portal-subtle)] truncate max-w-[180px]">{account.email}</span>
            <button type="button" onClick={onLogout} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--portal-border)] px-3 py-1.5 text-xs text-[var(--portal-muted)] hover:bg-[var(--portal-bg-muted)]">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 pb-28 lg:pb-8 lg:flex lg:gap-6 lg:pt-6">
        <nav
          className={`
            flex flex-col w-[min(280px,85vw)] shrink-0 gap-1 z-50
            fixed inset-y-0 left-0 top-0 pt-[4.5rem] px-4 pb-6 overflow-y-auto
            border-r backdrop-blur-md transition-transform duration-200 ease-out
            lg:static lg:translate-x-0 lg:w-52 lg:pt-0 lg:px-0 lg:pb-0 lg:border-r-0
            lg:sticky lg:top-20 lg:self-start lg:bg-transparent
            ${mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
          style={{ backgroundColor: "var(--portal-bg)", borderColor: "var(--portal-border)" }}
        >
          <p className="lg:hidden text-xs font-semibold uppercase tracking-wide text-[var(--portal-subtle)] mb-2 px-1">Menu</p>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={`portal-nav-btn flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === id ? "portal-nav-btn-active" : ""
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {id === "messages" && (summary?.unreadStaffMessages ?? 0) > 0 && (
                <span className="ml-auto text-[10px] bg-teal-500 text-white rounded-full px-1.5 py-0.5">{summary.unreadStaffMessages}</span>
              )}
              {id === "overview" && unreadCount > 0 && (
                <span className="ml-auto text-[10px] bg-teal-500 text-white rounded-full px-1.5 py-0.5">{unreadCount}</span>
              )}
            </button>
          ))}
        </nav>

        <main className="flex-1 min-w-0 space-y-5 pt-4 lg:pt-0">
          {notifOpen && (
            <div className="rounded-2xl border border-teal-500/30 bg-slate-900/90 p-4 shadow-xl">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-white flex items-center gap-2"><Bell className="w-4 h-4 text-teal-400" /> Notifications</h3>
                <button type="button" onClick={() => setNotifOpen(false)} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
              {notifications.length === 0 ? (
                <p className="text-slate-500 text-sm">No notifications right now.</p>
              ) : (
                <ul className="space-y-2 max-h-72 overflow-y-auto">
                  {notifications.map((n) => {
                    const unread = !readNotifIds.includes(n.id);
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => openNotif(n)}
                          className={`w-full text-left rounded-xl px-3 py-2 border transition-colors ${unread ? "border-teal-500/30 bg-teal-500/10" : "border-white/5 bg-white/[0.02]"}`}
                        >
                          <p className="text-sm font-medium text-white">{n.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>
                          <p className="text-[10px] text-slate-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {(localPayMsg || payMsg) && (
            <div className="flex items-center gap-2 text-sm text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 shrink-0" /> {localPayMsg || payMsg}
            </div>
          )}

          {/* Child selector */}
          <section className="rounded-2xl border border-white/8 bg-gradient-to-br from-slate-900/80 to-slate-950/90 p-4 shadow-xl shadow-black/20">
            <p className="text-xs text-slate-500 mb-3">Your child{children.length > 1 ? "ren" : ""}</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {children.map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveChildId(c.id)}
                  className={`flex items-center gap-3 shrink-0 rounded-xl px-3 py-2 border transition-all ${
                    activeChildId === c.id
                      ? "border-teal-500/50 bg-teal-500/10"
                      : "border-white/5 bg-white/[0.02] hover:border-white/10"
                  }`}
                >
                  <span className="w-9 h-9 rounded-full bg-teal-600/30 text-teal-200 flex items-center justify-center text-sm font-bold">
                    {initials(c.firstName, c.lastName)}
                  </span>
                  <span className="text-left">
                    <span className="block text-sm font-semibold text-white">{c.firstName} {c.lastName}</span>
                    <span className="block text-[11px] text-slate-500 font-mono">{c.admissionNumber}</span>
                  </span>
                </button>
              ))}
            </div>
            {activeChild && (
              <div className="mt-4 pt-4 border-t border-white/5 grid sm:grid-cols-2 gap-3 text-sm">
                <div className="space-y-1 text-slate-400">
                  <p><span className="text-slate-500">Class</span> <strong className="text-white">{enrollment?.className ?? "—"}</strong></p>
                  <p><span className="text-slate-500">Stream</span> <strong className="text-white">{enrollment?.streamName ?? "—"}</strong></p>
                  <p><span className="text-slate-500">Term</span> <strong className="text-teal-300">{currentTerm?.name ?? enrollment?.termName ?? "—"}</strong></p>
                  {academicYear && <p><span className="text-slate-500">Year</span> <strong className="text-slate-200">{academicYear.name}</strong></p>}
                </div>
                <div className="space-y-1">
                  {childFeeTerms.find((f: any) => f.termId === currentTerm?.id) ? (
                    (() => {
                      const cur = childFeeTerms.find((f: any) => f.termId === currentTerm?.id);
                      return (
                        <>
                          <p className="text-slate-500 text-xs uppercase tracking-wide">Current term fees</p>
                          <p className="text-white">Paid: <strong className="text-emerald-400">{formatMoney(cur.paidMinor, currency)}</strong></p>
                          <p className="text-white">Remaining: <strong className={cur.remainingMinor > 0 ? "text-amber-400" : "text-emerald-400"}>{formatMoney(cur.remainingMinor, currency)}</strong></p>
                        </>
                      );
                    })()
                  ) : childFeeTerms[0] ? (
                    <p className="text-slate-400 text-xs">Fee summary in Fees tab</p>
                  ) : null}
                  {attendanceRate != null && <p className="text-slate-400">Attendance: <strong className="text-teal-300">{attendanceRate}%</strong></p>}
                </div>
              </div>
            )}
          </section>

          {tab === "overview" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Fees due" value={formatMoney(summary?.feeDueMinor, currency)} alert={(summary?.feeDueMinor ?? 0) > 0} />
                <StatCard label="Present days" value={String(summary?.attendancePresent ?? 0)} />
                <StatCard label="Report cards" value={String(summary?.publishedReportCards ?? 0)} />
                <StatCard label="School notices" value={String(summary?.noticeboardCount ?? 0)} />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <Panel title="Latest from school" icon={Bell}>
                  {(data?.announcements ?? []).length === 0 ? (
                    <Empty text="No announcements yet." />
                  ) : (
                    <ul className="space-y-3">
                      {(data.announcements as any[]).slice(0, 4).map((a) => (
                        <li key={a.id} className="rounded-lg bg-white/[0.03] p-3 border border-white/5">
                          <p className="font-medium text-white text-sm">{a.title}</p>
                          <p className="text-slate-400 text-xs mt-1 line-clamp-2">{a.body}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="Quick actions" icon={ChevronRight}>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Class attendance", tab: "attendance" as TabId },
                      { label: "View fees", tab: "fees" as TabId },
                      { label: "Results", tab: "academics" as TabId },
                      { label: "Message school", tab: "messages" as TabId },
                    ].map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => selectTab(q.tab)}
                        className="text-left rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3 text-sm text-slate-200 hover:border-teal-500/30 hover:bg-teal-500/5 transition-colors"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </Panel>
              </div>

              <Panel title="Recent class attendance" icon={UserCheck}>
                <AttendanceMini rows={childClassAttendance.slice(0, 8)} />
                <button type="button" className="mt-3 text-xs text-teal-500 hover:text-teal-600" onClick={() => selectTab("attendance")}>
                  View full attendance →
                </button>
              </Panel>
            </>
          )}

          {tab === "attendance" && (
            <Panel
              title="Class attendance"
              icon={UserCheck}
              subtitle={
                enrollment
                  ? `${enrollment.className}${enrollment.streamName ? ` · ${enrollment.streamName}` : ""}${currentTerm?.name ? ` · ${currentTerm.name}` : ""}`
                  : "Daily register taken in class"
              }
            >
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setAttendanceScope("term")}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${attendanceScope === "term" ? "border-teal-500/40 bg-teal-500/10 text-teal-300" : "border-white/10 text-slate-400"}`}
                >
                  Current term
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceScope("all")}
                  className={`text-xs px-3 py-1.5 rounded-lg border ${attendanceScope === "all" ? "border-teal-500/40 bg-teal-500/10 text-teal-300" : "border-white/10 text-slate-400"}`}
                >
                  All records
                </button>
              </div>
              {attendanceRate != null && attendanceScope === "term" && (
                <p className="text-sm text-slate-400 mb-4">
                  Present rate this term: <strong className="text-teal-300">{attendanceRate}%</strong>
                  {" "}({childClassAttendance.filter((a: any) => a.inCurrentTerm === true && a.status === "present").length} present
                  {" "}of {childClassAttendance.filter((a: any) => a.inCurrentTerm === true).length} days recorded)
                </p>
              )}
              <AttendanceTable rows={childAttendanceFiltered} />
            </Panel>
          )}

          {tab === "academics" && (
            <>
              <Panel title="Results by term" icon={GraduationCap} subtitle={enrollment ? `${enrollment.className}${enrollment.streamName ? ` · ${enrollment.streamName}` : ""}` : "Published by school"}>
                {!data?.resultsVisible ? (
                  <Empty text="The school has not enabled results on the portal." />
                ) : childResultsByTerm.length === 0 ? (
                  <Empty text="No published report cards for this term yet." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 text-xs border-b border-white/10">
                          <th className="py-2 pr-3">Term</th>
                          <th className="py-2 pr-3">Average</th>
                          <th className="py-2 pr-3">Class rank</th>
                          <th className="py-2">PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {childResultsByTerm.map((rc: any) => {
                          const dj = (rc.dataJson ?? {}) as Record<string, unknown>;
                          const avg = dj.average ?? dj.mean;
                          const rank = dj.classRank ?? dj.rank;
                          return (
                            <tr key={rc.id} className="border-b border-white/5">
                              <td className="py-2.5 text-white">{rc.termName}</td>
                              <td className="py-2.5 text-teal-300">{avg != null ? String(avg) : "—"}</td>
                              <td className="py-2.5 text-slate-400">{rank != null ? String(rank) : "—"}</td>
                              <td className="py-2.5">
                                <button type="button" className="text-teal-400 text-xs" onClick={() => downloadPdf(`/s/${schoolSlug}/api/portal/pdf/report-card/${rc.id}`)}>Download</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </>
          )}

          {tab === "fees" && (
            <>
            <Panel
              title="School fees for the term"
              icon={Wallet}
              subtitle="Fee schedule set by the school (before payments & adjustments)"
            >
              {!currentTermSchoolFees ? (
                <Empty text={currentTerm ? `No fee schedule published for ${currentTerm.name} yet.` : "No fee schedule on file for this class."} />
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-white font-medium">{currentTermSchoolFees.termName}</span>
                    {currentTermSchoolFees.isCurrent && (
                      <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border border-teal-500/30 text-teal-300">Current</span>
                    )}
                    <span className="text-slate-500">· {currentTermSchoolFees.structureName}</span>
                    {currentTermSchoolFees.className && (
                      <span className="text-slate-500">· {currentTermSchoolFees.className}</span>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-500 border-b border-white/10">
                          <th className="py-2 pr-3">Fee item</th>
                          <th className="py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentTermSchoolFees.items.map((item: any, idx: number) => (
                          <tr key={idx} className="border-b border-white/5">
                            <td className="py-2.5 text-slate-200">{item.feeHeadName}</td>
                            <td className="py-2.5 text-right text-slate-300">{formatMoney(item.amountMinor, currency)}</td>
                          </tr>
                        ))}
                        <tr className="font-semibold">
                          <td className="py-2.5 text-white">Total for term</td>
                          <td className="py-2.5 text-right text-teal-300">{formatMoney(currentTermSchoolFees.totalMinor, currency)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {currentTermInvoice && (
                    <p className="text-xs text-slate-500 border-t border-white/5 pt-3">
                      On your account for this term: invoiced {formatMoney(currentTermInvoice.totalMinor, currency)},
                      {" "}paid {formatMoney(currentTermInvoice.paidMinor, currency)},
                      {" "}remaining {formatMoney(currentTermInvoice.remainingMinor, currency)}.
                    </p>
                  )}
                  {childSchoolTermFees.length > 1 && (
                    <details className="text-sm text-slate-400">
                      <summary className="cursor-pointer text-teal-400/90 hover:text-teal-300">Other terms</summary>
                      <ul className="mt-2 space-y-2">
                        {childSchoolTermFees.filter((f: any) => !f.isCurrent).map((f: any) => (
                          <li key={f.termId} className="rounded-lg border border-white/5 px-3 py-2">
                            <span className="text-white">{f.termName}</span>
                            <span className="text-slate-500 ml-2">— {formatMoney(f.totalMinor, currency)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </Panel>

            <Panel title="Fee balance by term" icon={Wallet} subtitle={`${activeChild?.firstName ?? "Student"} · invoiced amounts`}>
              {childFeeTerms.length === 0 ? (
                <Empty text="No fee invoices on record." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b border-white/10">
                        <th className="py-2 pr-3">Term</th>
                        <th className="py-2 pr-3">Total</th>
                        <th className="py-2 pr-3">Paid</th>
                        <th className="py-2">Remaining</th>
                      </tr>
                    </thead>
                    <tbody>
                      {childFeeTerms.map((f: any) => (
                        <tr key={f.termId ?? "general"} className={`border-b border-white/5 ${f.termId === currentTerm?.id ? "bg-teal-500/5" : ""}`}>
                          <td className="py-2.5 text-white font-medium">
                            {f.termName}
                            {f.termId === currentTerm?.id && <span className="ml-2 text-[10px] text-teal-400 uppercase">Current</span>}
                          </td>
                          <td className="py-2.5 text-slate-300">{formatMoney(f.totalMinor, currency)}</td>
                          <td className="py-2.5 text-emerald-400">{formatMoney(f.paidMinor, currency)}</td>
                          <td className={`py-2.5 font-medium ${f.remainingMinor > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                            {formatMoney(f.remainingMinor, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="Invoices & pay online" icon={Wallet} subtitle="Invoices and receipts from the bursar">
              {childStatements.length === 0 ? (
                <Empty text="No fee invoices for this child." />
              ) : (
                <ul className="space-y-3">
                  {childStatements.map((i: any) => {
                    const balance = (i.totalAmount ?? 0) - (i.paidAmount ?? 0);
                    const unpaid = balance > 0;
                    return (
                      <li key={i.id} className="rounded-xl border border-white/8 p-4 bg-white/[0.02]">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="font-semibold text-white">{i.invoiceNo}</p>
                            <p className="text-sm text-slate-400">{formatMoney(i.totalAmount, currency)}</p>
                            <span className={`inline-block mt-2 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${statusPill(i.status)}`}>{i.status}</span>
                            {unpaid && <p className="text-amber-300 text-sm mt-2">Balance: {formatMoney(balance, currency)}</p>}
                          </div>
                          <button type="button" className="text-xs text-slate-400 hover:text-white flex items-center gap-1" onClick={() => downloadPdf(`/s/${schoolSlug}/api/portal/pdf/invoice/${i.id}`)}>
                            <Download className="w-3 h-3" /> Invoice
                          </button>
                        </div>
                        {unpaid && data.paymentGatewaysEnabled && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button type="button" className="rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs px-3 py-1.5" disabled={payingId === i.id} onClick={() => payInvoice(i.id, "flutterwave")}>
                              <CreditCard className="w-3 h-3 inline mr-1" /> Pay card
                            </button>
                            <button type="button" className="rounded-lg border border-white/10 text-xs px-3 py-1.5" disabled={payingId === i.id} onClick={() => payInvoice(i.id, "mtn_momo")}>MTN MoMo</button>
                          </div>
                        )}
                        {unpaid && payingId === i.id && (
                          <input className="mt-2 w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm" placeholder="MoMo phone +256…" value={payerPhone} onChange={(e) => setPayerPhone(e.target.value)} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {childReceipts.length > 0 && (
                <div className="mt-6 pt-4 border-t border-white/5">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Payment receipts</p>
                  <ul className="space-y-2">
                    {childReceipts.map((r: any) => (
                      <li key={r.id} className="flex justify-between text-sm">
                        <span className="text-slate-300">{r.receiptNo} · {formatMoney(r.amount, currency)}</span>
                        <button type="button" className="text-teal-400 text-xs" onClick={() => downloadPdf(`/s/${schoolSlug}/api/portal/pdf/receipt/${r.id}`)}>PDF</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
            </>
          )}

          {tab === "calendar" && (
            <div className="space-y-4">
              <Panel title="School calendar" icon={Calendar} subtitle="Events, games, trips & activities from the school">
                <CalendarSection title="Coming up" events={calendar.upcoming} empty="No upcoming events in the next 90 days." />
              </Panel>
              <Panel title="Sports & games" icon={Trophy}>
                <CalendarSection title="" events={calendar.games} empty="No sports or games scheduled." />
              </Panel>
              <Panel title="Trips & excursions" icon={MapPin}>
                <CalendarSection title="" events={calendar.trips} empty="No trips or excursions listed." />
              </Panel>
              <Panel title="Academic events">
                <CalendarSection title="" events={calendar.academic} empty="No academic calendar events." />
              </Panel>
            </div>
          )}

          {tab === "family" && activeChild && (
            <div className="space-y-4">
              <Panel title="Parents & guardians" icon={Users} subtitle="Contacts registered by the school">
                {childFamily.length === 0 ? (
                  <Empty text="No guardians linked to this student yet." />
                ) : (
                  <ul className="space-y-3">
                    {childFamily.map((g: any) => (
                      <li key={g.id} className="rounded-xl border border-white/8 p-4 bg-white/[0.02]">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{g.firstName} {g.lastName}</p>
                          <span className="text-xs text-slate-500 capitalize">{g.relationship}</span>
                          {g.isPrimary && <span className="text-[10px] px-2 py-0.5 rounded border border-teal-500/30 text-teal-300">Primary</span>}
                          {g.isLoggedInParent && <span className="text-[10px] text-teal-400">You</span>}
                          {g.hasPortalAccount && !g.isLoggedInParent && <span className="text-[10px] text-slate-500">Portal account</span>}
                        </div>
                        {g.phone && <p className="text-sm text-slate-400 mt-2">Phone: {g.phone}</p>}
                        {g.email && <p className="text-sm text-slate-400">Email: {g.email}</p>}
                        {g.address && <p className="text-sm text-slate-500 mt-1">{g.address}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              {(childEmergency?.contact || childEmergency?.phone) && (
                <Panel title="Emergency / next of kin" icon={HeartPulse}>
                  <p className="text-white">{childEmergency.contact ?? "—"}</p>
                  {childEmergency.phone && <p className="text-slate-400 text-sm mt-1">{childEmergency.phone}</p>}
                </Panel>
              )}
            </div>
          )}

          {tab === "records" && (
            <div className="space-y-4">
              <Panel title="Gate passes" icon={DoorOpen} subtitle="Visitor entries logged by security">
                {childGatePasses.length === 0 ? <Empty text="No gate pass records." /> : (
                  <ul className="space-y-2">
                    {childGatePasses.map((g: any) => (
                      <li key={g.id} className="rounded-lg border border-white/5 p-3 text-sm">
                        <div className="flex justify-between">
                          <span className="font-mono text-teal-300/90">{g.passNumber}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${statusPill(g.status)}`}>{g.status}</span>
                        </div>
                        <p className="text-white mt-1">{g.visitorName}{g.relationToStudent ? ` · ${g.relationToStudent}` : ""}</p>
                        <p className="text-slate-500 text-xs mt-1">
                          {g.passDate} · In {g.inTime ? new Date(g.inTime).toLocaleTimeString() : "—"}
                          {g.outTime ? ` · Out ${new Date(g.outTime).toLocaleTimeString()}` : ""}
                        </p>
                        {g.purpose && <p className="text-slate-400 text-xs mt-1">{g.purpose}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Discipline" icon={ShieldAlert} subtitle="Incidents recorded by school staff">
                {childDiscipline.length === 0 ? <Empty text="No discipline records." /> : (
                  <ul className="space-y-3">
                    {childDiscipline.map((d: any) => (
                      <li key={d.id} className="rounded-lg border border-white/5 p-3">
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded border ${statusPill(d.severity)}`}>{d.severity}</span>
                          <span className="text-xs text-slate-500">{new Date(d.incidentDate).toLocaleDateString()} · {d.category}</span>
                        </div>
                        <p className="text-sm text-slate-200 mt-2">{d.description}</p>
                        {(d.actions ?? []).length > 0 && (
                          <ul className="mt-2 text-xs text-slate-400 space-y-1">
                            {d.actions.map((a: any, i: number) => (
                              <li key={i}>Action: {a.action}{a.notes ? ` — ${a.notes}` : ""}</li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              {childTransport && (
                <Panel title="Transport" icon={Bus}>
                  <p className="text-white font-medium">{childTransport.routeName}</p>
                  {(childTransport.stops ?? []).length > 0 && (
                    <ol className="mt-2 text-sm text-slate-400 list-decimal list-inside">
                      {childTransport.stops.map((s: any, i: number) => <li key={i}>{s.name}</li>)}
                    </ol>
                  )}
                </Panel>
              )}

              <Panel title="Health clinic" icon={HeartPulse}>
                {childSickbay.length === 0 ? <Empty text="No clinic visits on record." /> : (
                  <ul className="space-y-2 text-sm">
                    {childSickbay.map((v: any) => (
                      <li key={v.id} className="rounded-lg bg-white/[0.02] p-3 border border-white/5">
                        <p className="text-slate-300">{new Date(v.visitDate).toLocaleString()}</p>
                        <p className="text-white mt-1">{v.complaint}</p>
                        {v.treatment && <p className="text-slate-500 text-xs mt-1">Treatment: {v.treatment}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          )}

          {tab === "messages" && (
            <Panel title="Messages with school" icon={Mail} subtitle="Two-way communication with teachers & admin">
              <div className="rounded-xl bg-slate-950/60 border border-white/5 p-3 max-h-64 overflow-y-auto space-y-2 mb-4">
                {messages.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-6">No messages yet. Send a note about {activeChild?.firstName ?? "your child"}.</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`text-sm p-3 rounded-xl max-w-[85%] ${
                        m.senderType === "parent"
                          ? "ml-auto bg-teal-600/25 text-teal-50 border border-teal-500/20"
                          : "mr-auto bg-slate-800 text-slate-200 border border-white/5"
                      }`}
                    >
                      <p className="text-[10px] uppercase opacity-60 mb-1">{m.senderType === "parent" ? "You" : "School"}</p>
                      {m.body}
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm"
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  placeholder="Ask about fees, attendance, or an upcoming event…"
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                />
                <button type="button" onClick={sendMessage} className="rounded-xl bg-teal-600 hover:bg-teal-500 px-4 py-2 text-sm font-medium shrink-0">
                  Send
                </button>
              </div>
            </Panel>
          )}

          {tab === "profile" && (
            <ParentPortalProfile
              schoolSlug={schoolSlug}
              theme={portalTheme}
              onThemeChange={setPortalTheme}
              onAccountEmailChange={onAccountEmailChange}
            />
          )}

          {tab === "manage" && (
            <div className="space-y-4">
              <Panel title="What you can manage" icon={Settings2}>
                <ul className="grid sm:grid-cols-2 gap-2 text-sm">
                  {[
                    { ok: true, text: "Pay school fees online (when enabled)" },
                    { ok: true, text: "Send messages to school staff" },
                    { ok: true, text: "Submit leave requests for your child" },
                    { ok: true, text: "Update your profile, theme, and family contacts" },
                    { ok: true, text: "View class attendance and school fee schedules" },
                    { ok: true, text: "Download invoices, receipts & report cards" },
                    { ok: false, text: "Edit grades or attendance (school staff only)" },
                    { ok: false, text: "Approve gate passes or discipline (view only)" },
                  ].map((item) => (
                    <li key={item.text} className={`flex gap-2 rounded-lg px-3 py-2 border ${item.ok ? "border-teal-500/20 bg-teal-500/5 text-slate-200" : "border-white/5 text-slate-500"}`}>
                      <span className={item.ok ? "text-teal-400" : "text-slate-600"}>{item.ok ? "✓" : "—"}</span>
                      {item.text}
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Leave requests" icon={CalendarOff} subtitle="Submit for approval by the school">
                <LeaveForm onSubmit={submitLeave} />
                <ul className="mt-4 space-y-2">
                  {childLeaves.map((l: any) => (
                    <li key={l.id} className="flex justify-between text-sm rounded-lg border border-white/5 px-3 py-2">
                      <span className="text-slate-300">
                        {new Date(l.startDate).toLocaleDateString()} – {new Date(l.endDate).toLocaleDateString()}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${statusPill(l.status)}`}>{l.status}</span>
                    </li>
                  ))}
                  {childLeaves.length === 0 && <Empty text="No leave requests yet." />}
                </ul>
              </Panel>
            </div>
          )}
        </main>
      </div>

      <nav className="portal-bottom-nav lg:hidden fixed bottom-0 inset-x-0 z-30 border-t backdrop-blur pb-safe">
        <div className="flex overflow-x-auto gap-0.5 px-1 py-2 no-scrollbar">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={`flex flex-col items-center gap-0.5 shrink-0 min-w-[52px] px-2 py-1 text-[10px] ${tab === id ? "text-teal-500" : "text-[var(--portal-subtle)]"}`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

function StatCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${alert ? "border-amber-500/30 bg-amber-950/20" : "border-white/8 bg-white/[0.02]"}`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${alert ? "text-amber-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="portal-panel rounded-2xl p-5">
      <div className="mb-4">
        <h2 className="portal-panel-title text-base font-semibold flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-teal-500" />}
          {title}
        </h2>
        {subtitle && <p className="portal-panel-subtitle text-xs mt-1">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="portal-empty text-sm py-4 text-center">{text}</p>;
}

function AttendanceMini({ rows }: { rows: any[] }) {
  if (!rows.length) return <Empty text="No class attendance records yet." />;
  return (
    <ul className="text-sm space-y-1.5">
      {rows.map((r, i) => (
        <li key={r.id ?? i} className="flex justify-between items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/[0.02]">
          <div className="min-w-0">
            <span className="text-slate-400 block">{r.date ? new Date(r.date).toLocaleDateString() : "—"}</span>
            {(r.className || r.streamName) && (
              <span className="text-[11px] text-slate-500 truncate block">
                {r.className}{r.streamName ? ` · ${r.streamName}` : ""}
              </span>
            )}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded border capitalize shrink-0 ${statusPill(r.status)}`}>{r.status}</span>
        </li>
      ))}
    </ul>
  );
}

function AttendanceTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <Empty text="No class attendance records for this period." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500 border-b border-white/10">
            <th className="py-2 pr-3">Date</th>
            <th className="py-2 pr-3">Class</th>
            <th className="py-2 pr-3">Stream</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-white/5">
              <td className="py-2.5 text-slate-300 whitespace-nowrap">{r.date ? new Date(r.date).toLocaleDateString() : "—"}</td>
              <td className="py-2.5 text-white">{r.className ?? "—"}</td>
              <td className="py-2.5 text-slate-400">{r.streamName ?? "—"}</td>
              <td className="py-2.5">
                <span className={`text-xs px-2 py-0.5 rounded border capitalize ${statusPill(r.status)}`}>{r.status}</span>
              </td>
              <td className="py-2.5 text-slate-500 text-xs max-w-[140px] truncate">{r.note ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalendarSection({ title, events, empty }: { title: string; events: any[]; empty: string }) {
  if (!events?.length) return <Empty text={empty} />;
  return (
    <ul className="space-y-2">
      {title ? <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">{title}</p> : null}
      {events.map((e: any) => (
        <li key={e.id} className="rounded-lg border border-white/5 p-3">
          <p className="font-medium text-white text-sm">{e.title}</p>
          <p className="text-xs text-slate-500 mt-1 capitalize">{e.category ?? e.eventType} · {new Date(e.startsAt).toLocaleString()}</p>
          {e.venue && <p className="text-xs text-slate-400">{e.venue}</p>}
          {e.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{e.description}</p>}
        </li>
      ))}
    </ul>
  );
}

function LeaveForm({ onSubmit }: { onSubmit: (f: { startDate: string; endDate: string; reason: string }) => void }) {
  const [form, setForm] = useState({ startDate: "", endDate: "", reason: "" });
  return (
    <form
      className="grid sm:grid-cols-3 gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
    >
      <input type="date" required className="rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
      <input type="date" required className="rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
      <input required className="rounded-lg bg-slate-900 border border-white/10 px-3 py-2 text-sm sm:col-span-1" placeholder="Reason for leave" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      <button type="submit" className="sm:col-span-3 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm py-2 font-medium">
        Submit leave request
      </button>
    </form>
  );
}
