import { useCallback, useEffect, useState } from "react";
import { api } from "../../../api/client";
import { Megaphone, Search, ChevronDown, ChevronUp } from "lucide-react";

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: string;
  createdAt: string;
  publishAt?: string;
};

function readStorageKey(schoolSlug: string) {
  return `student_portal_read_ann_${schoolSlug}`;
}

function loadReadIds(schoolSlug: string): Set<string> {
  try {
    const raw = localStorage.getItem(readStorageKey(schoolSlug));
    return new Set(JSON.parse(raw ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveReadIds(schoolSlug: string, ids: Set<string>) {
  localStorage.setItem(readStorageKey(schoolSlug), JSON.stringify([...ids]));
}

export function StudentNoticeboardPanel({ schoolSlug }: { schoolSlug: string }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds(schoolSlug));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, Announcement>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      const res = await api.get(`/s/${schoolSlug}/api/portal/student/noticeboard${q}`);
      setItems(res.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, query]);

  useEffect(() => { load(); }, [load]);

  const markRead = (id: string) => {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    saveReadIds(schoolSlug, next);
  };

  const markAllRead = () => {
    const next = new Set(readIds);
    for (const a of items) next.add(a.id);
    setReadIds(next);
    saveReadIds(schoolSlug, next);
  };

  const openDetail = async (a: Announcement) => {
    markRead(a.id);
    if (expanded === a.id) {
      setExpanded(null);
      return;
    }
    setExpanded(a.id);
    if (!detail[a.id]) {
      try {
        const res = await api.get(`/s/${schoolSlug}/api/portal/student/noticeboard/${a.id}`);
        setDetail((d) => ({ ...d, [a.id]: res.data }));
      } catch {
        setDetail((d) => ({ ...d, [a.id]: a }));
      }
    }
  };

  const unreadCount = items.filter((a) => !readIds.has(a.id)).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--portal-muted)]">
        Official announcements from your school. {unreadCount > 0 && (
          <span className="portal-accent-text font-medium">{unreadCount} unread</span>
        )}
      </p>

      <form
        onSubmit={(e) => { e.preventDefault(); setQuery(searchInput); }}
        className="flex gap-2"
      >
        <input
          className="portal-input flex-1 rounded-lg text-sm"
          placeholder="Search announcements…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit" className="portal-btn-primary rounded-lg text-white text-xs px-3 py-2 inline-flex items-center gap-1">
          <Search className="w-3.5 h-3.5" /> Search
        </button>
      </form>

      {items.length > 0 && unreadCount > 0 && (
        <button type="button" className="text-xs portal-accent-text font-medium" onClick={markAllRead}>
          Mark all as read
        </button>
      )}

      {loading ? (
        <p className="portal-empty text-sm">Loading announcements…</p>
      ) : items.length === 0 ? (
        <p className="portal-empty text-sm">No announcements right now.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => {
            const isOpen = expanded === a.id;
            const full = detail[a.id] ?? a;
            const unread = !readIds.has(a.id);
            return (
              <li
                key={a.id}
                className={`rounded-xl border overflow-hidden ${unread ? "border-[var(--portal-accent)]/40 bg-[var(--portal-surface-muted)]" : "border-[var(--portal-border)]"}`}
              >
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 flex items-start justify-between gap-2"
                  onClick={() => openDetail(a)}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--portal-fg-strong)] flex items-center gap-2">
                      <Megaphone className="w-3.5 h-3.5 portal-accent-text shrink-0" />
                      {a.title}
                      {unread && <span className="w-2 h-2 rounded-full bg-[var(--portal-accent)] shrink-0" title="Unread" />}
                    </p>
                    <p className="text-xs text-[var(--portal-subtle)] mt-0.5 capitalize">
                      {a.audience} · {new Date(a.publishAt ?? a.createdAt).toLocaleString()}
                    </p>
                    {!isOpen && (
                      <p className="text-sm text-[var(--portal-muted)] mt-2 line-clamp-2">{a.body}</p>
                    )}
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-[var(--portal-border-soft)] pt-3">
                    <p className="text-sm text-[var(--portal-fg)] whitespace-pre-wrap">{full.body}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
