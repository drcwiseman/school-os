import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, downloadPdf } from "../../../api/client";
import {
  LayoutDashboard,
  GraduationCap,
  Wallet,
  Calendar,
  BookOpen,
  ClipboardList,
  Library,
  FolderOpen,
  Bell,
  Bus,
  Sparkles,
  LogOut,
  Menu,
  X,
  UserCircle,
  Clock,
  FileText,
  Download,
  CheckCircle,
  AlertCircle,
  CalendarOff,
  Megaphone,
  ChevronRight,
  RefreshCw,
  MessageCircle,
  UserCheck,
} from "lucide-react";
import { applyPortalTheme, getStoredPortalTheme } from "../../../utils/theme";
import { resolvePortalMediaUrl } from "../../../utils/portal-media";
import { StudentPortalProfile } from "./StudentPortalProfile";
import { StudentProgrammeBio } from "./StudentProgrammeBio";
import { StudentHomeworkPanel } from "./StudentHomeworkPanel";
import { StudentCbtPanel } from "./StudentCbtPanel";
import { StudentLibraryPanel } from "./StudentLibraryPanel";
import { StudentMaterialsPanel } from "./StudentMaterialsPanel";
import { StudentCalendarPanel } from "./StudentCalendarPanel";
import { StudentNoticeboardPanel } from "./StudentNoticeboardPanel";
import { StudentTutorPanel } from "./StudentTutorPanel";
import { StudentTransportPanel } from "./StudentTransportPanel";
import { StudentLeavePanel } from "./StudentLeavePanel";

type TabId =
  | "overview"
  | "programme"
  | "attendance"
  | "results"
  | "fees"
  | "timetable"
  | "homework"
  | "exams"
  | "library"
  | "resources"
  | "calendar"
  | "notices"
  | "messages"
  | "leave"
  | "transport"
  | "tutor"
  | "profile";

type PortalTheme = "light" | "dark";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Home", icon: LayoutDashboard },
  { id: "programme", label: "My programme", icon: GraduationCap },
  { id: "attendance", label: "Attendance", icon: UserCheck },
  { id: "results", label: "Results", icon: FileText },
  { id: "fees", label: "Fees & invoices", icon: Wallet },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "timetable", label: "Timetable", icon: Clock },
  { id: "homework", label: "Homework", icon: ClipboardList },
  { id: "exams", label: "CBT exams", icon: BookOpen },
  { id: "library", label: "Library", icon: Library },
  { id: "resources", label: "Materials", icon: FolderOpen },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "notices", label: "Noticeboard", icon: Megaphone },
  { id: "leave", label: "Leave", icon: CalendarOff },
  { id: "transport", label: "Transport", icon: Bus },
  { id: "tutor", label: "AI tutor", icon: Sparkles },
  { id: "profile", label: "Profile", icon: UserCircle },
];

const QUICK_LINKS: { tab: TabId; label: string }[] = [
  { tab: "results", label: "View results" },
  { tab: "fees", label: "View invoices" },
  { tab: "timetable", label: "Timetable" },
  { tab: "exams", label: "CBT exams" },
  { tab: "library", label: "Library" },
  { tab: "homework", label: "Homework" },
  { tab: "messages", label: "Messages" },
  { tab: "profile", label: "Profile" },
];

function formatMoney(cents: number | undefined, currency = "UGX") {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0 }).format(cents / 100);
}

function statusPill(status: string) {
  const s = status.toLowerCase();
  const map: Record<string, string> = {
    paid: "student-portal-pill--ok",
    pending: "student-portal-pill--warn",
    approved: "student-portal-pill--ok",
    rejected: "student-portal-pill--danger",
    active: "student-portal-pill--ok",
    present: "student-portal-pill--ok",
    absent: "student-portal-pill--danger",
    submitted: "student-portal-pill--ok",
  };
  return map[s] ?? "student-portal-pill--neutral";
}

function initials(first?: string, last?: string) {
  return `${(first ?? "?")[0]}${(last ?? "")[0] ?? ""}`.toUpperCase();
}

export const StudentPortalDashboard: React.FC<{
  schoolSlug: string;
  account: { email: string };
  data: any;
  summary: any;
  onLogout: () => void;
  payMsg?: string;
  onAccountEmailChange?: (email: string) => void;
  initialTheme?: PortalTheme;
}> = ({ schoolSlug, account, data, summary, onLogout, payMsg, onAccountEmailChange, initialTheme }) => {
  const [tab, setTab] = useState<TabId>("overview");
  const [portalTheme, setPortalTheme] = useState<PortalTheme>(() => initialTheme ?? getStoredPortalTheme(schoolSlug));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [onlineClasses, setOnlineClasses] = useState<any[]>([]);
  const [curriculum, setCurriculum] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgBody, setMsgBody] = useState("");
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`student_portal_notif_${schoolSlug}`) ?? "[]");
    } catch {
      return [];
    }
  });
  const [profileMeta, setProfileMeta] = useState<{ pendingProfile: Record<string, string> | null; profilePendingApproval: boolean }>({
    pendingProfile: null,
    profilePendingApproval: false,
  });
  const [messageRecipients, setMessageRecipients] = useState<Array<{ userId: string; name: string; role?: string; kind: string }>>([]);
  const [recipientsError, setRecipientsError] = useState("");
  const [recipientsLoaded, setRecipientsLoaded] = useState(false);
  const [recipientUserId, setRecipientUserId] = useState("");
  const [publishedResults, setPublishedResults] = useState<any[]>([]);
  const [timetableFilter, setTimetableFilter] = useState<"all" | "teaching" | "exam" | "mock" | "test">("all");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [photoVersion, setPhotoVersion] = useState(0);

  const student = data?.student;
  const studentId = student?.id;
  const currency = data?.currency ?? "UGX";
  const notifications: any[] = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !readNotifIds.includes(n.id)).length;

  useEffect(() => {
    setProfilePhotoUrl(student?.photoUrl ?? null);
  }, [student?.photoUrl]);

  const hasProfilePhoto = Boolean(profilePhotoUrl);
  const profilePhotoPreview = useMemo(() => {
    if (!profilePhotoUrl) return "";
    return resolvePortalMediaUrl(profilePhotoUrl, photoVersion);
  }, [profilePhotoUrl, photoVersion]);

  useEffect(() => {
    applyPortalTheme(portalTheme, schoolSlug);
  }, [portalTheme, schoolSlug]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [tab]);

  useEffect(() => {
    if (!schoolSlug) return;
    Promise.all([
      api.get(`/s/${schoolSlug}/api/portal/student/timetable`).catch(() => ({ data: [] })),
      api.get(`/s/${schoolSlug}/api/portal/student/online-classes`).catch(() => ({ data: [] })),
      api.get(`/s/${schoolSlug}/api/portal/curriculum`).catch(() => ({ data: null })),
    ]).then(([t, o, c]) => {
      setTimetable(t.data ?? data?.timetable ?? []);
      setOnlineClasses(o.data ?? []);
      setCurriculum(c.data);
    });
  }, [schoolSlug]);

  const unreadStaffMessages = summary?.unreadStaffMessages ?? 0;

  const loadMessages = useCallback(async () => {
    if (!schoolSlug || !studentId) return;
    const res = await api.get(`/s/${schoolSlug}/api/portal/messages/${studentId}`);
    setMessages(res.data ?? []);
    for (const m of res.data ?? []) {
      if (m.senderType === "staff" && !m.readAt) {
        api.patch(`/s/${schoolSlug}/api/portal/messages/${m.id}/read`, {}).catch(() => {});
      }
    }
  }, [schoolSlug, studentId]);

  useEffect(() => {
    if (tab === "messages") loadMessages();
    if (tab === "messages" && !recipientsLoaded) {
      api.get(`/s/${schoolSlug}/api/portal/messages/recipients`)
        .then((r) => {
          setMessageRecipients(r.data ?? []);
          setRecipientsError("");
          setRecipientsLoaded(true);
        })
        .catch((e: any) => {
          setRecipientsError(e.message ?? "Could not load recipients");
          setRecipientsLoaded(true);
        });
    }
    if (tab === "results" && !publishedResults.length) {
      api.get(`/s/${schoolSlug}/api/portal/student/results`).then((r) => setPublishedResults(r.data ?? [])).catch(() => {});
    }
    if (tab === "programme" && !profileMeta.profilePendingApproval && student) {
      api.get(`/s/${schoolSlug}/api/portal/profile`).then((r) => {
        const d = r.data;
        setProfileMeta({
          pendingProfile: d.pendingProfile ?? null,
          profilePendingApproval: Boolean(d.profilePendingApproval),
        });
      }).catch(() => {});
    }
  }, [tab, loadMessages, schoolSlug, recipientsLoaded, publishedResults.length, profileMeta.profilePendingApproval, student]);

  useEffect(() => {
    if (!schoolSlug || !studentId) return;
    loadMessages().catch(() => setMessages([]));
  }, [schoolSlug, studentId, loadMessages]);

  const selectTab = (id: TabId) => {
    setTab(id);
    setMobileNavOpen(false);
  };

  const markNotifRead = (id: string) => {
    const next = [...new Set([...readNotifIds, id])];
    setReadNotifIds(next);
    localStorage.setItem(`student_portal_notif_${schoolSlug}`, JSON.stringify(next));
  };

  const enrollment = data?.enrollment;
  const currentTerm = data?.currentTerm;
  const academicYear = data?.currentAcademicYear;
  const feeDueMinor = summary?.feeDueMinor ?? data?.feeDueMinor ?? 0;
  const programmeLabel = enrollment?.className
    ? `${enrollment.className}${enrollment.streamName ? ` · ${enrollment.streamName}` : ""}`
    : "Not assigned to a class";

  const attendanceRate = useMemo(() => {
    const rows = data?.attendance ?? [];
    const present = rows.filter((r: any) => r.status === "present").length;
    if (!rows.length) return null;
    return Math.round((present / rows.length) * 100);
  }, [data?.attendance]);

  const downloadReportCard = async (id: string) => {
    await downloadPdf(`/s/${schoolSlug}/api/portal/pdf/report-card/${id}`);
  };

  const downloadInvoice = async (id: string) => {
    await downloadPdf(`/s/${schoolSlug}/api/portal/pdf/invoice/${id}`);
  };

  const sendMessage = async () => {
    if (!studentId || !msgBody.trim() || !recipientUserId) return;
    await api.post(`/s/${schoolSlug}/api/portal/messages`, { studentId, body: msgBody, recipientUserId });
    setMsgBody("");
    await loadMessages();
  };

  const payInvoice = async (invoiceId: string) => {
    setPayingId(invoiceId);
    try {
      const res = await api.post(`/s/${schoolSlug}/api/portal/payments/initiate`, {
        invoiceId,
        provider: "flutterwave",
      });
      if (res.data?.checkoutUrl) window.location.href = res.data.checkoutUrl;
    } finally {
      setPayingId(null);
    }
  };

  const filteredTimetable = useMemo(() => {
    if (timetableFilter === "all") return timetable;
    return timetable.filter((p: any) => (p.type ?? "teaching") === timetableFilter);
  }, [timetable, timetableFilter]);

  const timetableByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const p of filteredTimetable) {
      const key = p.date ? `${p.dayLabel} · ${p.date}` : (p.dayLabel ?? `Day ${p.dayOfWeek}`);
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [filteredTimetable]);

  const joinOnlineClass = async (classId: string) => {
    await api.post(`/s/${schoolSlug}/api/portal/student/online-classes/${classId}/join`, {});
    const o = await api.get(`/s/${schoolSlug}/api/portal/student/online-classes`);
    setOnlineClasses(o.data ?? []);
  };

  const handleProfilePhotoChange = useCallback((url: string | null) => {
    setProfilePhotoUrl((prev) => {
      if (prev === url) return prev;
      setPhotoVersion((v) => v + 1);
      return url;
    });
  }, []);

  return (
    <div className="portal-shell student-portal flex flex-col h-[100dvh] overflow-hidden" data-portal-theme={portalTheme}>
      {mobileNavOpen && (
        <button type="button" className="fixed inset-0 z-40 bg-black/50 lg:hidden" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} />
      )}

      <header className="portal-header shrink-0 z-30 border-b backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              className="portal-mobile-menu-btn lg:hidden shrink-0 rounded-lg border p-2"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] portal-accent-text font-semibold">Student portal</p>
              <h1 className="text-base sm:text-lg font-bold truncate capitalize text-[var(--portal-fg-strong)]">{schoolSlug.replace(/-/g, " ")}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setNotifOpen((o) => !o)}
              className="relative rounded-lg border border-[var(--portal-border)] p-2 text-[var(--portal-muted)]"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full portal-badge text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            <span className="hidden md:inline text-xs text-[var(--portal-subtle)]">Hi, {student?.firstName ?? "Student"}</span>
            <button type="button" onClick={onLogout} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--portal-border)] px-3 py-1.5 text-xs text-[var(--portal-muted)]">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {QUICK_LINKS.map(({ tab: t, label }) => (
              <button
                key={t}
                type="button"
                onClick={() => selectTab(t)}
                className="student-portal-quick-btn shrink-0 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="student-portal-body flex flex-1 min-h-0 max-w-7xl w-full mx-auto">
        <aside
          className={`
            student-portal-sidebar flex flex-col w-[min(300px,88vw)] shrink-0 gap-1 z-50 border-r
            max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:top-0 max-lg:pt-[5.5rem] max-lg:px-3 max-lg:pb-6 max-lg:overflow-y-auto
            transition-transform duration-200
            lg:relative lg:translate-x-0 lg:w-56 lg:pt-4 lg:px-2 lg:pb-4 lg:overflow-y-auto lg:overscroll-contain
            ${mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          <div className="student-portal-profile-card rounded-xl p-4 mb-3 lg:mb-4">
            <div className="flex items-center gap-3">
              {profilePhotoPreview ? (
                <img src={profilePhotoPreview} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-[var(--portal-border)] shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full portal-avatar-fallback flex items-center justify-center font-bold text-lg shrink-0">
                  {initials(student?.firstName, student?.lastName)}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate text-[var(--portal-fg-strong)]">{student?.firstName} {student?.lastName}</p>
                <p className="text-[11px] student-portal-admission font-mono truncate">{student?.admissionNumber}</p>
              </div>
            </div>
          </div>

          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={`portal-nav-btn flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium ${
                tab === id ? "portal-nav-btn-active student-portal-nav-active" : ""
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
              {id === "fees" && feeDueMinor > 0 && (
                <span className="ml-auto text-[10px] bg-red-500 text-white rounded-full px-1.5">!</span>
              )}
              {id === "messages" && unreadStaffMessages > 0 && (
                <span className="ml-auto text-[10px] bg-red-500 text-white rounded-full px-1.5">{unreadStaffMessages > 9 ? "9+" : unreadStaffMessages}</span>
              )}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setPortalTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="mt-4 portal-nav-btn rounded-lg px-3 py-2 text-xs"
          >
            {portalTheme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </aside>

        <main className="student-portal-main flex-1 min-w-0 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 lg:py-6 space-y-5">
          {!hasProfilePhoto && tab !== "profile" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>A profile photo is required. Upload one to complete your portal profile.</span>
              </div>
              <button type="button" onClick={() => selectTab("profile")} className="portal-btn-primary rounded-lg px-3 py-1.5 text-xs font-medium shrink-0">
                Upload photo
              </button>
            </div>
          )}
          {payMsg && (
            <div className="flex items-center gap-2 text-sm portal-flash-success rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4" /> {payMsg}
            </div>
          )}

          {notifOpen && (
            <Panel title="Notifications" icon={Bell} onClose={() => setNotifOpen(false)}>
              {notifications.length === 0 ? (
                <p className="portal-empty text-sm">No notifications.</p>
              ) : (
                <ul className="space-y-2">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => {
                          markNotifRead(n.id);
                          if (n.linkTab) selectTab(n.linkTab as TabId);
                          setNotifOpen(false);
                        }}
                        className={`w-full text-left rounded-xl px-3 py-2 border text-sm ${
                          readNotifIds.includes(n.id) ? "border-[var(--portal-border-soft)]" : "portal-notif-highlight"
                        }`}
                      >
                        <p className="font-medium text-[var(--portal-fg-strong)]">{n.title}</p>
                        <p className="text-xs text-[var(--portal-muted)] mt-0.5">{n.body}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {/* Status ribbon — inspired by university portal summary bar */}
          <div className="student-portal-status-ribbon rounded-xl border p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[var(--portal-subtle)]">Programme</p>
                <p className="font-semibold text-[var(--portal-fg-strong)]">{programmeLabel}</p>
              </div>
              <span className="student-portal-pill student-portal-pill--ok">Active</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {academicYear && (
                <span className="student-portal-pill student-portal-pill--ok text-[11px]">
                  YR {academicYear.name}
                </span>
              )}
              {currentTerm && (
                <span className="student-portal-pill student-portal-pill--ok text-[11px]">{currentTerm.name}</span>
              )}
              <span className={`student-portal-pill text-[11px] ${enrollment ? "student-portal-pill--ok" : "student-portal-pill--danger"}`}>
                {enrollment ? "Enrolled" : "Not enrolled"}
              </span>
              {feeDueMinor > 0 ? (
                <span className="student-portal-pill student-portal-pill--danger text-[11px]">
                  Fees due {formatMoney(feeDueMinor, currency)}
                </span>
              ) : (
                <span className="student-portal-pill student-portal-pill--ok text-[11px]">Fees clear</span>
              )}
              {attendanceRate != null && (
                <span className="student-portal-pill student-portal-pill--warn text-[11px]">Attendance {attendanceRate}%</span>
              )}
            </div>
          </div>

          {tab === "overview" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Fees due" value={formatMoney(feeDueMinor, currency)} alert={feeDueMinor > 0} />
                <StatCard label="Present days" value={String(summary?.attendancePresent ?? 0)} />
                <StatCard label="Homework done" value={String(summary?.submissionsCount ?? 0)} />
                <StatCard label="CBT exams" value={String((data?.cbtExams ?? []).length)} />
              </div>

              {(data?.reportCard || (data?.reportCards ?? []).length > 0) && data?.resultsVisible !== false && (
                <Panel title="Latest results" icon={GraduationCap}>
                  <button type="button" className="portal-accent-text text-sm font-medium" onClick={() => selectTab("results")}>
                    View all results <ChevronRight className="w-4 h-4 inline" />
                  </button>
                </Panel>
              )}

              <Panel title="Today's timetable" icon={Clock}>
                {timetable.length === 0 ? (
                  <p className="portal-empty text-sm">No timetable published yet.</p>
                ) : (
                  <ul className="text-sm space-y-2">
                    {timetable.slice(0, 6).map((p: any) => (
                      <li key={p.id} className="flex justify-between gap-2 border-b border-[var(--portal-border-soft)] pb-2">
                        <span className="text-[var(--portal-fg-strong)]">{p.subjectName ?? "Period"}</span>
                        <span className="text-[var(--portal-subtle)] text-xs">{p.dayLabel} P{p.periodNo}{p.startTime ? ` · ${p.startTime}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" onClick={() => selectTab("timetable")} className="mt-3 text-xs portal-accent-text font-medium">Full timetable →</button>
              </Panel>

              <Panel title="Noticeboard" icon={Megaphone}>
                <NoticeList items={data?.noticeboard ?? []} limit={4} onMore={() => selectTab("notices")} />
              </Panel>
            </div>
          )}

          {tab === "programme" && (
            <div className="space-y-5">
              <Panel title="Registration" icon={UserCircle}>
                <dl className="grid sm:grid-cols-2 gap-3 text-sm">
                  <Field label="Name" value={`${student?.firstName ?? ""} ${student?.lastName ?? ""}`} />
                  <Field label="Admission no." value={student?.admissionNumber} />
                  <Field label="Gender" value={student?.gender} />
                  <Field label="Status" value={student?.status} />
                  <Field label="Class" value={enrollment?.className ?? "—"} />
                  <Field label="Stream" value={enrollment?.streamName ?? "—"} />
                  <Field label="Portal email" value={account.email} />
                </dl>
              </Panel>
              <Panel title="Bio (approval required)" icon={UserCircle}>
                <StudentProgrammeBio
                  schoolSlug={schoolSlug}
                  student={student}
                  pendingProfile={profileMeta.pendingProfile}
                  profilePendingApproval={profileMeta.profilePendingApproval}
                  onSubmitted={() => {
                    api.get(`/s/${schoolSlug}/api/portal/profile`).then((r) => {
                      setProfileMeta({
                        pendingProfile: r.data.pendingProfile ?? null,
                        profilePendingApproval: Boolean(r.data.profilePendingApproval),
                      });
                    }).catch(() => {});
                  }}
                />
              </Panel>
              {curriculum?.framework && (
                <Panel title="Curriculum" icon={BookOpen}>
                  <p className="text-sm font-medium text-[var(--portal-fg-strong)]">{curriculum.framework.name}</p>
                  <ul className="mt-2 text-sm text-[var(--portal-muted)] space-y-1">
                    {(curriculum.units ?? []).map((u: any) => (
                      <li key={u.id}>{u.title}</li>
                    ))}
                  </ul>
                </Panel>
              )}
              {(data?.schoolTermFees ?? []).length > 0 && (
                <Panel title="Fee structure (school)" icon={Wallet}>
                  {(data.schoolTermFees as any[]).map((f: any) => (
                    <div key={f.termId} className="mb-4 last:mb-0">
                      <p className="font-medium text-sm text-[var(--portal-fg-strong)]">{f.termName}{f.isCurrent ? " · Current" : ""}</p>
                      <ul className="mt-2 text-sm space-y-1">
                        {f.items.map((it: any, i: number) => (
                          <li key={i} className="flex justify-between text-[var(--portal-muted)]">
                            <span>{it.feeHeadName}</span>
                            <span>{formatMoney(it.amountMinor, currency)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs font-semibold mt-2 text-[var(--portal-fg-strong)]">Total {formatMoney(f.totalMinor, currency)}</p>
                    </div>
                  ))}
                </Panel>
              )}
            </div>
          )}

          {tab === "attendance" && (
            <Panel title="My attendance" icon={UserCheck}>
              {(data?.attendance ?? []).length === 0 ? (
                <p className="portal-empty text-sm">No attendance records yet.</p>
              ) : (
                <ul className="space-y-2 text-sm max-h-[60vh] overflow-y-auto">
                  {(data.attendance as any[]).map((r: any, i: number) => (
                    <li key={i} className="flex justify-between gap-2 rounded-lg border border-[var(--portal-border)] px-3 py-2">
                      <span>{r.date ? new Date(r.date).toLocaleDateString() : "—"}</span>
                      <span className={`student-portal-pill text-[10px] ${statusPill(r.status)}`}>{r.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {tab === "results" && (
            <Panel title="Report cards & results" icon={GraduationCap}>
              {data?.resultsVisible === false ? (
                <p className="portal-empty text-sm">Results are hidden by your school. Contact the office.</p>
              ) : (
                <>
                  <p className="text-xs text-[var(--portal-subtle)] mb-3">Published assessment marks</p>
                  {publishedResults.length === 0 ? (
                    <p className="portal-empty text-sm mb-4">No published marks yet.</p>
                  ) : (
                    <ul className="space-y-3 mb-6">
                      {publishedResults.map((m: any) => (
                        <li key={m.id} className="rounded-xl border border-[var(--portal-border)] px-4 py-3 text-sm">
                          <p className="font-medium text-[var(--portal-fg-strong)]">{m.subjectName ?? "Subject"} · {m.assessmentTitle}</p>
                          <p className="text-xs text-[var(--portal-subtle)] capitalize">{m.assessmentType}</p>
                          <p className="mt-1 text-[var(--portal-fg)]">
                            {m.grade ? `Grade ${m.grade}` : m.score != null ? `Score ${m.score}` : "—"}
                            {m.remarks ? ` · ${m.remarks}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                  {(data?.reportCards ?? []).length > 0 || data?.reportCard ? (
                    <div className="pt-4 border-t border-[var(--portal-border)]">
                      <p className="text-sm font-semibold mb-3 text-[var(--portal-fg-strong)]">Report cards</p>
                      <ul className="space-y-3">
                        {(data.reportCards?.length ? data.reportCards : data.reportCard ? [data.reportCard] : []).map((rc: any) => (
                          <li key={rc.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--portal-border)] px-4 py-3">
                            <div>
                              <p className="font-medium text-sm text-[var(--portal-fg-strong)]">Report card</p>
                              <p className="text-xs text-[var(--portal-subtle)]">{rc.createdAt ? new Date(rc.createdAt).toLocaleDateString() : ""}</p>
                            </div>
                            <button type="button" className="inline-flex items-center gap-1 text-xs portal-accent-text font-medium" onClick={() => downloadReportCard(rc.id)}>
                              <Download className="w-3.5 h-3.5" /> PDF
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="portal-empty text-sm">No published report cards yet.</p>
                  )}
                </>
              )}
            </Panel>
          )}

          {tab === "fees" && (
            <div className="space-y-5">
              <Panel title="Invoices & balance" icon={Wallet}>
                <p className="text-2xl font-bold text-[var(--portal-fg-strong)] mb-4">{formatMoney(feeDueMinor, currency)} <span className="text-sm font-normal text-[var(--portal-subtle)]">total due</span></p>
                {(data?.feeByTerm ?? []).length > 0 && (
                  <div className="grid sm:grid-cols-2 gap-3 mb-4">
                    {(data.feeByTerm as any[]).map((t: any) => (
                      <div key={t.termId ?? "general"} className="rounded-lg border border-[var(--portal-border)] p-3 text-sm">
                        <p className="font-medium">{t.termName}</p>
                        <p className="text-[var(--portal-muted)]">Remaining {formatMoney(t.remainingMinor, currency)}</p>
                      </div>
                    ))}
                  </div>
                )}
                <ul className="space-y-2">
                  {(data?.statements ?? []).map((inv: any) => (
                    <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--portal-border)] px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium text-[var(--portal-fg-strong)]">{inv.invoiceNo ?? "Invoice"}</p>
                        <p className="text-xs text-[var(--portal-subtle)]">Balance {formatMoney(Math.max(0, inv.totalAmount - inv.paidAmount), currency)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`student-portal-pill text-[10px] ${statusPill(inv.status)}`}>{inv.status}</span>
                        <button type="button" className="text-xs portal-accent-text" onClick={() => downloadInvoice(inv.id)}>PDF</button>
                        {inv.status !== "paid" && Math.max(0, inv.totalAmount - inv.paidAmount) > 0 && (
                          <button
                            type="button"
                            disabled={payingId === inv.id}
                            className="portal-btn-primary text-xs px-2 py-1 rounded-lg"
                            onClick={() => payInvoice(inv.id)}
                          >
                            {payingId === inv.id ? "…" : "Pay"}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                  {!(data?.statements ?? []).length && <p className="portal-empty text-sm">No invoices on file.</p>}
                </ul>
              </Panel>
            </div>
          )}

          {tab === "messages" && (
            <Panel title="Messages with school" icon={MessageCircle}>
              {recipientsError && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-3">{recipientsError}</p>
              )}
              <div className="flex gap-2 mb-4">
                <select
                  className="portal-input rounded-lg text-sm"
                  value={recipientUserId}
                  onChange={(e) => setRecipientUserId(e.target.value)}
                  aria-label="Message recipient"
                >
                  <option value="">Send to…</option>
                  {messageRecipients.map((r) => (
                    <option key={r.userId} value={r.userId}>
                      {r.name} ({r.kind === "administration" ? "Administration" : r.role ?? "Teacher"})
                    </option>
                  ))}
                </select>
              </div>
              {!messageRecipients.length && !recipientsError && (
                <p className="text-xs text-[var(--portal-subtle)] mb-3">
                  No teachers listed yet — you may still be waiting for class assignment, or ask the office to link your class teachers.
                </p>
              )}
              <div className="rounded-xl border border-[var(--portal-border)] bg-[var(--portal-bg-muted)] p-3 max-h-72 overflow-y-auto space-y-2 mb-4">
                {messages.length === 0 ? (
                  <p className="portal-empty text-sm text-center py-6">No messages yet. Send a note to teachers or the office.</p>
                ) : (
                  messages.map((m: any) => (
                    <div
                      key={m.id}
                      className={`text-sm p-3 rounded-xl max-w-[85%] ${
                        m.senderType === "student"
                          ? "portal-msg-self rounded-xl px-3 py-2"
                          : "mr-auto bg-[var(--portal-bg-elevated)] border border-[var(--portal-border)]"
                      }`}
                    >
                      <p className="text-[10px] uppercase opacity-60 mb-1">{m.senderType === "student" ? "You" : "School"}</p>
                      {m.body}
                      <p className="text-[10px] opacity-50 mt-1">{m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  className="portal-input flex-1 rounded-xl px-4 py-2.5 text-sm"
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  placeholder="Ask about homework, fees, or events…"
                  autoComplete="off"
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                />
                <button type="button" onClick={sendMessage} className="portal-btn-primary rounded-xl px-4 py-2 text-sm font-medium text-white shrink-0">
                  Send
                </button>
              </div>
            </Panel>
          )}

          {tab === "timetable" && (
            <Panel title="Timetable" icon={Clock} action={<button type="button" className="text-xs text-[var(--portal-muted)]" onClick={() => window.location.reload()}><RefreshCw className="w-3.5 h-3.5 inline" /> Reload</button>}>
              <div className="flex flex-wrap gap-2 mb-4">
                {(["all", "teaching", "exam", "mock", "test"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTimetableFilter(t)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium capitalize ${timetableFilter === t ? "portal-theme-selected" : "border border-[var(--portal-border)]"}`}
                  >
                    {t === "all" ? "All" : t}
                  </button>
                ))}
              </div>
              {Object.keys(timetableByDay).length === 0 ? (
                <p className="portal-empty text-sm">No periods scheduled. Ask your class teacher to publish the timetable.</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(timetableByDay).map(([day, periods]) => (
                    <div key={day}>
                      <p className="text-xs font-bold uppercase tracking-wider portal-accent-text mb-2">{day}</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-[var(--portal-subtle)] border-b border-[var(--portal-border)]">
                              <th className="py-2 pr-3">Period</th>
                              <th className="py-2 pr-3">Subject</th>
                              <th className="py-2 pr-3">Teacher</th>
                              <th className="py-2">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {periods.map((p: any) => (
                              <tr key={p.id} className="border-b border-[var(--portal-border-soft)]">
                                <td className="py-2 pr-3 font-mono text-xs">P{p.periodNo}</td>
                                <td className="py-2 pr-3 text-[var(--portal-fg-strong)]">{p.subjectName ?? "—"}</td>
                                <td className="py-2 pr-3 text-[var(--portal-muted)]">{p.teacherName ?? "—"}</td>
                                <td className="py-2 text-[var(--portal-muted)] text-xs">{p.startTime && p.endTime ? `${p.startTime}–${p.endTime}` : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {tab === "homework" && (
            <Panel title="Homework & assignments" icon={ClipboardList}>
              <StudentHomeworkPanel schoolSlug={schoolSlug} />
            </Panel>
          )}

          {tab === "exams" && (
            <Panel title="CBT exams & tests" icon={BookOpen}>
              <StudentCbtPanel schoolSlug={schoolSlug} />
            </Panel>
          )}

          {tab === "library" && (
            <Panel title="Library" icon={Library}>
              <StudentLibraryPanel schoolSlug={schoolSlug} />
            </Panel>
          )}

          {tab === "resources" && (
            <Panel title="Study materials & online classes" icon={FolderOpen}>
              <StudentMaterialsPanel schoolSlug={schoolSlug} onlineClasses={onlineClasses} onJoinClass={joinOnlineClass} />
            </Panel>
          )}

          {tab === "calendar" && (
            <Panel title="Academic calendar & events" icon={Calendar}>
              <StudentCalendarPanel schoolSlug={schoolSlug} />
            </Panel>
          )}

          {tab === "notices" && (
            <Panel title="Noticeboard & announcements" icon={Megaphone}>
              <StudentNoticeboardPanel schoolSlug={schoolSlug} />
            </Panel>
          )}

          {tab === "leave" && studentId && (
            <Panel title="Leave requests" icon={CalendarOff}>
              <StudentLeavePanel schoolSlug={schoolSlug} studentId={studentId} initial={data?.leaves ?? []} />
            </Panel>
          )}

          {tab === "transport" && (
            <Panel title="Transport" icon={Bus}>
              <StudentTransportPanel schoolSlug={schoolSlug} initial={data?.transport ?? null} />
            </Panel>
          )}

          {tab === "tutor" && (
            <Panel title="AI study tutor" icon={Sparkles}>
              <StudentTutorPanel schoolSlug={schoolSlug} />
            </Panel>
          )}

          {tab === "profile" && (
            <StudentPortalProfile
              schoolSlug={schoolSlug}
              theme={portalTheme}
              onThemeChange={setPortalTheme}
              onAccountEmailChange={onAccountEmailChange}
              onPhotoChange={handleProfilePhotoChange}
            />
          )}
        </main>
      </div>
    </div>
  );
};

function Panel({
  title,
  icon: Icon,
  children,
  action,
  onClose,
}: {
  title: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <section className="portal-panel rounded-2xl p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="portal-panel-title font-semibold flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 portal-accent-text" />}
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {action}
          {onClose && (
            <button type="button" onClick={onClose} className="text-[var(--portal-subtle)]"><X className="w-4 h-4" /></button>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`portal-stat rounded-xl p-3 border ${alert ? "border-amber-500/40" : "border-[var(--portal-border)]"}`}>
      <p className="portal-stat-label text-xs">{label}</p>
      <p className={`portal-stat-value text-lg font-bold ${alert ? "text-amber-600 dark:text-amber-300" : ""}`}>{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-[var(--portal-subtle)]">{label}</dt>
      <dd className="text-[var(--portal-fg-strong)] capitalize">{value ?? "—"}</dd>
    </div>
  );
}

function NoticeList({ items, limit, onMore }: { items: any[]; limit?: number; onMore?: () => void }) {
  const list = limit ? items.slice(0, limit) : items;
  if (!list.length) return <p className="portal-empty text-sm">No announcements.</p>;
  return (
    <>
      <ul className="space-y-3 text-sm">
        {list.map((a: any) => (
          <li key={a.id}>
            <p className="font-medium text-[var(--portal-fg-strong)]">{a.title}</p>
            <p className="text-[var(--portal-muted)] text-xs mt-0.5 line-clamp-3">{a.body}</p>
          </li>
        ))}
      </ul>
      {onMore && items.length > (limit ?? 0) && (
        <button type="button" onClick={onMore} className="mt-3 text-xs portal-accent-text font-medium">View all →</button>
      )}
    </>
  );
}
