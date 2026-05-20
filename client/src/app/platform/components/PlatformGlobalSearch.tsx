import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Building2,
  Users,
  LifeBuoy,
  FileText,
  Loader2,
  X,
} from "lucide-react";
import { api } from "../../api/client";

type SearchResult = {
  id: string;
  type: "school" | "platform_user" | "support_ticket" | "invoice";
  title: string;
  subtitle: string;
  href: string;
};

const TYPE_META: Record<
  SearchResult["type"],
  { label: string; icon: React.ReactNode }
> = {
  school: { label: "School", icon: <Building2 size={14} /> },
  platform_user: { label: "Platform user", icon: <Users size={14} /> },
  support_ticket: { label: "Support", icon: <LifeBuoy size={14} /> },
  invoice: { label: "Invoice", icon: <FileText size={14} /> },
};

export const PlatformGlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  const runSearch = useCallback(async (q: string) => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const r = await api.get(
        `/api/platform/search?q=${encodeURIComponent(term)}&limit=20`,
      );
      const payload = r.data as { results?: SearchResult[] };
      setResults(payload?.results ?? []);
      setActiveIdx(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => runSearch(query), 280);
    return () => clearTimeout(t);
  }, [query, open, runSearch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    navigate(href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && query.length >= 2) setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIdx]) {
      e.preventDefault();
      go(results[activeIdx].href);
    }
  };

  const showPanel = open && (query.trim().length >= 2 || loading);

  return (
    <div ref={wrapRef} className="relative hidden md:block">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Search schools, users, invoices…"
        className="w-48 lg:w-80 max-w-[40vw] bg-slate-50 border border-slate-200 rounded-full pl-9 pr-12 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        aria-label="Search platform"
        aria-expanded={showPanel}
        aria-autocomplete="list"
        role="combobox"
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:flex gap-1 pointer-events-none">
        <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-500">
          ⌘
        </kbd>
        <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white border border-slate-200 text-slate-500">
          K
        </kbd>
      </div>

      {showPanel && (
        <div
          className="absolute top-full mt-2 right-0 w-[min(24rem,90vw)] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
          role="listbox"
        >
          {loading && (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500 justify-center">
              <Loader2 size={16} className="animate-spin" /> Searching…
            </div>
          )}
          {!loading && results.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-500 text-center">
              No results for &ldquo;{query.trim()}&rdquo;
            </p>
          )}
          {!loading && results.length > 0 && (
            <ul className="max-h-[min(360px,50vh)] overflow-y-auto py-1">
              {results.map((r, idx) => {
                const meta = TYPE_META[r.type];
                return (
                  <li key={`${r.type}-${r.id}`}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={idx === activeIdx}
                      className={`w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors ${
                        idx === activeIdx ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => go(r.href)}
                    >
                      <span className="mt-0.5 text-slate-400 shrink-0">{meta.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900 truncate">
                          {r.title}
                        </span>
                        <span className="block text-xs text-slate-500 truncate">{r.subtitle}</span>
                      </span>
                      <span className="text-[10px] font-semibold uppercase text-slate-400 shrink-0 mt-0.5">
                        {meta.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {query.trim().length >= 2 && !loading && (
            <div className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400 flex justify-between">
              <span>↑↓ navigate · Enter open</span>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-700"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setOpen(false);
                }}
              >
                <X size={12} className="inline" /> Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
