import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus } from "lucide-react";

export type FeatureOption = {
  id: string;
  code: string;
  name: string;
  description?: string;
  category?: string;
};

type Props = {
  options: FeatureOption[];
  categoryLabel: (cat?: string) => string;
  groupByCategory: (items: FeatureOption[]) => [string, FeatureOption[]][];
  onSelect: (code: string) => void;
  placeholder?: string;
};

export const SearchableFeaturePicker: React.FC<Props> = ({
  options,
  categoryLabel,
  groupByCategory,
  onSelect,
  placeholder = "Search features to add…",
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.code.toLowerCase().includes(q) ||
        (f.description?.toLowerCase().includes(q) ?? false) ||
        categoryLabel(f.category).toLowerCase().includes(q),
    );
  }, [options, query, categoryLabel]);

  const grouped = useMemo(() => groupByCategory(filtered), [filtered, groupByCategory]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (code: string) => {
    onSelect(code);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            className="input text-sm w-full pl-9 pr-3"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && filtered[0]) {
                e.preventDefault();
                pick(filtered[0].code);
              }
            }}
            autoComplete="off"
          />
        </div>
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-xs text-slate-500 text-center">No features match your search.</p>
          ) : (
            grouped.map(([cat, items]) => (
              <div key={cat} className="border-b border-slate-100 last:border-0">
                <p className="sticky top-0 bg-slate-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {categoryLabel(cat)}
                </p>
                <ul>
                  {items.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-start gap-2 group"
                        onClick={() => pick(f.code)}
                      >
                        <Plus size={14} className="text-slate-400 group-hover:text-blue-600 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{f.name}</p>
                          <p className="text-[10px] font-mono text-slate-500">{f.code}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}
      <p className="text-[10px] text-slate-400 mt-1">Type to search · click a row to add · Enter selects first match</p>
    </div>
  );
};
