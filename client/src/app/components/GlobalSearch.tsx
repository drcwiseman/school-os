import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { Search } from "lucide-react";

export const GlobalSearch: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<any>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.length < 2) { setResults(null); return; }
    const t = setTimeout(() => {
      api.get(`/s/${schoolSlug}/api/search?q=${encodeURIComponent(q)}`).then((r) => setResults(r.data)).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [q, schoolSlug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (type: string, id: string) => {
    setOpen(false);
    setQ("");
    if (type === "student") navigate(`/s/${schoolSlug}/students/${id}`);
    else if (type === "invoice") navigate(`/s/${schoolSlug}/finance`);
    else navigate(`/s/${schoolSlug}/admin`);
  };

  const flat = results ? [
    ...(results.students ?? []).map((r: any) => ({ ...r, type: "student" })),
    ...(results.invoices ?? []).map((r: any) => ({ ...r, type: "invoice" })),
    ...(results.users ?? []).map((r: any) => ({ ...r, type: "user" })),
    ...(results.staff ?? []).map((r: any) => ({ ...r, type: "staff" })),
  ] : [];

  return (
    <div className="relative mb-6" ref={ref}>
      <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2">
        <Search className="w-4 h-4 text-slate-500" />
        <input
          className="bg-transparent border-0 outline-none text-sm text-white flex-1"
          placeholder="Search students, invoices… (⌘K)"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && flat.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full card p-2 max-h-64 overflow-y-auto">
          {flat.slice(0, 12).map((r) => (
            <button key={`${r.type}-${r.id}`} type="button" className="w-full text-left px-3 py-2 rounded hover:bg-slate-800 text-sm" onClick={() => go(r.type, r.id)}>
              <span className="text-slate-500 uppercase text-xs">{r.type}</span> {r.label} <span className="text-slate-600">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
