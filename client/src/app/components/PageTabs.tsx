export type PageTabItem<T extends string> = {
  id: T;
  label: string;
  badge?: number;
};

export function PageTabs<T extends string>({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: PageTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={`w-full min-w-0 ${className}`}>
      <label className="sr-only" htmlFor="page-tab-select">
        Section
      </label>
      <select
        id="page-tab-select"
        className="input w-full lg:hidden mb-1"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {tabs.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
            {t.badge != null && t.badge > 0 ? ` (${t.badge})` : ""}
          </option>
        ))}
      </select>

      <div className="hidden lg:block w-full overflow-x-auto pb-1 scrollbar-thin">
        <div className="flex flex-wrap gap-2 min-w-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                value === t.id
                  ? "bg-primary-600 text-white shadow-sm"
                  : "bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200 border border-slate-700/50"
              }`}
            >
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="text-[10px] bg-white/20 rounded-full px-1.5 py-0.5">{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory -mx-1 px-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`snap-start shrink-0 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap ${
              value === t.id ? "bg-primary-600 text-white" : "bg-slate-800 text-slate-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
