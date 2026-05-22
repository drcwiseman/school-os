import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { ConfirmAction } from "../components/ConfirmAction";
import { useAuth } from "../state/AuthContext";
import { BookOpen, Loader2, Plus, Pencil, Search, Save } from "lucide-react";

type Article = {
  id: string;
  title: string;
  category: string;
  bodyMd: string;
  sortOrder?: number;
};

const CATEGORIES = ["getting-started", "multi-campus", "portal", "finance", "academics", "messaging", "general"];

export const Help: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("settings.manage");

  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [active, setActive] = useState<Article | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", category: "general", bodyMd: "", sortOrder: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/s/${schoolSlug}/api/help`);
      const list: Article[] = res.data ?? [];
      setArticles(list);
      setActive((prev) => {
        if (prev && list.some((a) => a.id === prev.id)) return list.find((a) => a.id === prev.id) ?? list[0] ?? null;
        return list[0] ?? null;
      });
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Load failed", "error");
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return articles.filter((a) => {
      if (categoryFilter && a.category !== categoryFilter) return false;
      if (!q) return true;
      return a.title.toLowerCase().includes(q) || a.bodyMd.toLowerCase().includes(q) || a.category.includes(q);
    });
  }, [articles, search, categoryFilter]);

  const resetForm = () => {
    setForm({ title: "", category: "general", bodyMd: "", sortOrder: articles.length });
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = (a: Article) => {
    setEditId(a.id);
    setForm({ title: a.title, category: a.category, bodyMd: a.bodyMd, sortOrder: a.sortOrder ?? 0 });
    setShowForm(true);
    setActive(a);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;
    try {
      if (editId) {
        await api.patch(`/s/${schoolSlug}/api/help/${editId}`, form);
        toast("Article updated", "success");
      } else {
        await api.post(`/s/${schoolSlug}/api/help`, form);
        toast("Article created", "success");
      }
      resetForm();
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/s/${schoolSlug}/api/help/${id}`);
      toast("Article deleted", "success");
      if (active?.id === id) setActive(null);
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  if (loading && !articles.length) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex-col sm:flex-row gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary-400" />
            Help &amp; training
          </h1>
          <p className="text-slate-400 mt-1">In-app guides your staff can read without leaving SchoolOS</p>
        </div>
        {canManage && (
          <button type="button" className="btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> New article
          </button>
        )}
      </div>

      {showForm && canManage && (
        <form onSubmit={submit} className="card p-6 space-y-3">
          <h3 className="font-semibold text-white">{editId ? "Edit article" : "New article"}</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <input className="input" required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="input" type="number" placeholder="Sort order" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} />
          </div>
          <textarea
            className="input min-h-[200px] font-mono text-sm"
            required
            placeholder="Markdown content…"
            value={form.bodyMd}
            onChange={(e) => setForm({ ...form, bodyMd: e.target.value })}
          />
          <p className="text-xs text-slate-500">Supports plain text and simple markdown (**bold**, lists, line breaks).</p>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary"><Save className="w-4 h-4" /> {editId ? "Save" : "Publish"}</button>
            <button type="button" className="btn-ghost" onClick={resetForm}>Cancel</button>
          </div>
        </form>
      )}

      <div className="grid lg:grid-cols-3 gap-4 min-h-[420px]">
        <div className="card p-4 flex flex-col gap-3 lg:col-span-1">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-9 w-full text-sm"
              placeholder="Search articles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="flex-1 overflow-y-auto space-y-1 max-h-[480px]">
            {filtered.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">No articles match.</p>
            ) : filtered.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setActive(a)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active?.id === a.id ? "bg-primary-600/30 text-primary-100 border border-primary-600/40" : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <span className="block font-medium text-white truncate">{a.title}</span>
                <span className="text-xs text-slate-500 capitalize">{a.category}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-600">{filtered.length} of {articles.length} articles</p>
        </div>

        <div className="card p-6 lg:col-span-2 flex flex-col">
          {active ? (
            <>
              <div className="flex justify-between items-start gap-3 mb-4 pb-4 border-b border-slate-800">
                <div>
                  <span className="text-xs uppercase tracking-wide text-primary-400">{active.category}</span>
                  <h2 className="text-xl font-semibold text-white mt-1">{active.title}</h2>
                </div>
                {canManage && (
                  <div className="flex gap-1 shrink-0">
                    <button type="button" className="btn-ghost text-xs" onClick={() => startEdit(active)}>
                      <Pencil className="w-3 h-3 inline" /> Edit
                    </button>
                    <ConfirmAction label="Delete" confirmMessage={`Delete “${active.title}”?`} onConfirm={() => remove(active.id)} />
                  </div>
                )}
              </div>
              <div className="prose prose-invert max-w-none flex-1 overflow-y-auto">
                <HelpBody markdown={active.bodyMd} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-500 py-16">
              <BookOpen className="w-12 h-12 mb-3 opacity-40" />
              <p>Select an article or create one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/** Lightweight markdown-ish rendering (no extra deps). */
function HelpBody({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  return (
    <div className="text-slate-300 text-sm leading-relaxed space-y-3">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <br key={i} />;
        if (trimmed.startsWith("### ")) return <h4 key={i} className="text-white font-semibold mt-4">{trimmed.slice(4)}</h4>;
        if (trimmed.startsWith("## ")) return <h3 key={i} className="text-white font-semibold text-lg mt-4">{trimmed.slice(3)}</h3>;
        if (trimmed.startsWith("# ")) return <h2 key={i} className="text-white font-bold text-xl mt-4">{trimmed.slice(2)}</h2>;
        if (trimmed.startsWith("- ")) return <li key={i} className="ml-4 list-disc">{formatInline(trimmed.slice(2))}</li>;
        return <p key={i}>{formatInline(trimmed)}</p>;
      })}
    </div>
  );
}

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} className="text-white font-medium">{p.slice(2, -2)}</strong>;
    }
    return p;
  });
}
