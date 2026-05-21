import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { BookOpen, Loader2 } from "lucide-react";

type Article = { id: string; title: string; category: string; bodyMd: string };

export const Help: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [active, setActive] = useState<Article | null>(null);

  useEffect(() => {
    api.get(`/s/${schoolSlug}/api/help`)
      .then((res) => {
        const list = res.data ?? [];
        setArticles(list);
        setActive(list[0] ?? null);
      })
      .finally(() => setLoading(false));
  }, [schoolSlug]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><BookOpen className="w-6 h-6" /> Help & training</h1>
        <p className="text-slate-400 mt-1">In-app guides for your school team</p>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card p-4 space-y-1">
          {articles.map((a) => (
            <button key={a.id} type="button" onClick={() => setActive(a)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${active?.id === a.id ? "bg-primary-600/30 text-primary-200" : "text-slate-400 hover:text-white"}`}>
              {a.title}
            </button>
          ))}
        </div>
        <div className="card p-6 lg:col-span-2 prose prose-invert max-w-none">
          {active ? (
            <>
              <p className="text-xs text-slate-500 uppercase">{active.category}</p>
              <h2 className="text-xl font-semibold text-white mt-1">{active.title}</h2>
              <p className="text-slate-300 mt-4 whitespace-pre-wrap">{active.bodyMd}</p>
            </>
          ) : (
            <p className="text-slate-500">No articles yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};
