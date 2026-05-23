import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../api/client";
import { Calendar, MapPin, ChevronDown, ChevronUp, Clock } from "lucide-react";

type CalendarOverview = {
  currentAcademicYear: { name: string; startDate: string; endDate: string } | null;
  currentTerm: { name: string; startDate: string; endDate: string } | null;
  academicYears: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent: boolean;
    terms: Array<{ id: string; name: string; startDate: string; endDate: string; isCurrent: boolean }>;
  }>;
};

type SchoolEvent = {
  id: string;
  title: string;
  description?: string;
  eventType: string;
  venue?: string;
  startsAt: string;
  endsAt?: string;
  isPast?: boolean;
  isOngoing?: boolean;
};

const EVENT_TYPES = ["all", "academic", "sports", "cultural", "holiday", "exam", "other"] as const;

function formatRange(start: string, end?: string) {
  const s = new Date(start);
  if (!end) return s.toLocaleString();
  const e = new Date(end);
  if (s.toDateString() === e.toDateString()) {
    return `${s.toLocaleDateString()} · ${s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return `${s.toLocaleString()} – ${e.toLocaleString()}`;
}

export function StudentCalendarPanel({ schoolSlug }: { schoolSlug: string }) {
  const [overview, setOverview] = useState<CalendarOverview | null>(null);
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [eventType, setEventType] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, SchoolEvent>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const typeQ = eventType !== "all" ? `&eventType=${encodeURIComponent(eventType)}` : "";
      const [ov, ev] = await Promise.all([
        api.get(`/s/${schoolSlug}/api/portal/student/calendar`),
        api.get(`/s/${schoolSlug}/api/portal/student/calendar/events?filter=${filter}${typeQ}`),
      ]);
      setOverview(ov.data ?? null);
      setEvents(ev.data ?? []);
    } catch {
      setOverview(null);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, filter, eventType]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (!detail[id]) {
      try {
        const res = await api.get(`/s/${schoolSlug}/api/portal/student/calendar/events/${id}`);
        setDetail((d) => ({ ...d, [id]: res.data }));
      } catch { /* ignore */ }
    }
  };

  const grouped = useMemo(() => {
    const map: Record<string, SchoolEvent[]> = {};
    for (const e of events) {
      const key = new Date(e.startsAt).toLocaleDateString(undefined, { month: "long", year: "numeric" });
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return map;
  }, [events]);

  if (loading && !overview) {
    return <p className="portal-empty text-sm">Loading calendar…</p>;
  }

  return (
    <div className="space-y-6">
      {(overview?.currentAcademicYear || overview?.currentTerm) && (
        <section className="grid sm:grid-cols-2 gap-3">
          {overview?.currentAcademicYear && (
            <div className="rounded-xl border border-[var(--portal-border)] p-4">
              <p className="text-[10px] uppercase tracking-wider text-[var(--portal-subtle)]">Academic year</p>
              <p className="font-semibold text-[var(--portal-fg-strong)] mt-1">{overview.currentAcademicYear.name}</p>
              <p className="text-xs text-[var(--portal-muted)] mt-1">
                {new Date(overview.currentAcademicYear.startDate).toLocaleDateString()} – {new Date(overview.currentAcademicYear.endDate).toLocaleDateString()}
              </p>
            </div>
          )}
          {overview?.currentTerm && (
            <div className="rounded-xl border border-[var(--portal-border)] p-4 portal-theme-selected">
              <p className="text-[10px] uppercase tracking-wider portal-accent-text">Current term</p>
              <p className="font-semibold text-[var(--portal-fg-strong)] mt-1">{overview.currentTerm.name}</p>
              <p className="text-xs text-[var(--portal-muted)] mt-1">
                {new Date(overview.currentTerm.startDate).toLocaleDateString()} – {new Date(overview.currentTerm.endDate).toLocaleDateString()}
              </p>
            </div>
          )}
        </section>
      )}

      {(overview?.academicYears?.length ?? 0) > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider portal-accent-text mb-2">Term dates</h3>
          <div className="space-y-3">
            {overview!.academicYears.map((y) => (
              <div key={y.id} className="rounded-xl border border-[var(--portal-border)] p-3">
                <p className="text-sm font-medium text-[var(--portal-fg-strong)]">
                  {y.name}{y.isCurrent ? " · Current" : ""}
                </p>
                {y.terms.length === 0 ? (
                  <p className="text-xs text-[var(--portal-subtle)] mt-1">No terms configured.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs text-[var(--portal-muted)]">
                    {y.terms.map((t) => (
                      <li key={t.id} className={t.isCurrent ? "portal-accent-text font-medium" : ""}>
                        {t.name}: {new Date(t.startDate).toLocaleDateString()} – {new Date(t.endDate).toLocaleDateString()}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-wrap gap-2 mb-3">
          {(["upcoming", "past", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1 text-xs font-medium capitalize ${filter === f ? "portal-theme-selected" : "border border-[var(--portal-border)]"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {EVENT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setEventType(t)}
              className={`rounded-lg px-2 py-0.5 text-[10px] font-medium capitalize ${eventType === t ? "portal-theme-selected" : "border border-[var(--portal-border)]"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <h3 className="text-xs font-bold uppercase tracking-wider portal-accent-text mb-2 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" /> School events
        </h3>

        {events.length === 0 ? (
          <p className="portal-empty text-sm">No events in this view.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([month, list]) => (
              <div key={month}>
                <p className="text-xs font-semibold text-[var(--portal-subtle)] mb-2">{month}</p>
                <ul className="space-y-2">
                  {list.map((e) => {
                    const isOpen = expanded === e.id;
                    const full = detail[e.id] ?? e;
                    return (
                      <li key={e.id} className="rounded-xl border border-[var(--portal-border)] overflow-hidden">
                        <button
                          type="button"
                          className="w-full text-left px-4 py-3 flex items-start justify-between gap-2"
                          onClick={() => openDetail(e.id)}
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--portal-fg-strong)]">{e.title}</p>
                            <p className="text-xs text-[var(--portal-subtle)] mt-0.5 flex items-center gap-1 flex-wrap">
                              <Clock className="w-3 h-3" /> {formatRange(e.startsAt, e.endsAt)}
                              {e.venue && (
                                <span className="inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {e.venue}</span>
                              )}
                            </p>
                            <span className="text-[10px] student-portal-pill student-portal-pill--neutral mt-1 inline-block capitalize">
                              {e.eventType}
                              {e.isOngoing && " · Now"}
                              {e.isPast && " · Ended"}
                            </span>
                          </div>
                          {isOpen ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                        </button>
                        {isOpen && full.description && (
                          <p className="px-4 pb-3 text-sm text-[var(--portal-muted)] whitespace-pre-wrap border-t border-[var(--portal-border-soft)] pt-3">
                            {full.description}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
