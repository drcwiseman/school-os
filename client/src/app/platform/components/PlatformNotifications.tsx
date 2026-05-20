import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Loader2 } from "lucide-react";
import { api } from "../../api/client";

type AuditItem = {
  action: string;
  tenant_name?: string;
  created_at: string;
  source: string;
};

export const PlatformNotifications: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AuditItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const fetchItems = () => {
    setLoading(true);
    return api
      .get("/api/platform/audit-logs?limit=12")
      .then((res) => setItems(res.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (open) fetchItems();
  }, [open]);

  const count = items.length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Recent activity"
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[min(24rem,70vh)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl z-50 flex flex-col"
        >
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">Notifications</p>
            <Link
              to="/platform/system/audit"
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
              onClick={() => setOpen(false)}
            >
              View all
            </Link>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8 px-2">No recent platform events.</p>
            ) : (
              <ul className="space-y-1">
                {items.map((row) => (
                  <li
                    key={`${row.source}-${row.action}-${row.created_at}`}
                    className="rounded-lg px-3 py-2 hover:bg-slate-50"
                  >
                    <p className="text-sm font-medium text-slate-800 truncate">{row.action}</p>
                    <p className="text-xs text-slate-500 truncate">{row.tenant_name ?? row.source}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(row.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
