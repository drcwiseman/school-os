import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Loader2, AlertCircle, AlertTriangle } from "lucide-react";
import { api } from "../../api/client";

type Alert = {
  id: string;
  type: string;
  severity: "error" | "warn" | "info";
  title: string;
  message: string;
  href: string;
  createdAt: string;
};

export const PlatformNotifications: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
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
      .get("/api/platform/notifications")
      .then((res) => {
        const data = res.data as { unreadCount: number; alerts: Alert[] };
        setUnreadCount(data.unreadCount ?? 0);
        setAlerts(data.alerts ?? []);
      })
      .catch(() => {
        setUnreadCount(0);
        setAlerts([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
    const t = setInterval(fetchItems, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (open) fetchItems();
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        aria-label="Alerts"
        aria-expanded={open}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-[min(24rem,70vh)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl z-50 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">Alerts</p>
            <Link to="/platform/system/audit" className="text-xs text-blue-600" onClick={() => setOpen(false)}>
              Audit log
            </Link>
          </div>
          <div className="overflow-y-auto flex-1 p-2">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              </div>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">All clear — no open alerts.</p>
            ) : (
              <ul className="space-y-1">
                {alerts.map((a) => (
                  <li key={`${a.type}-${a.id}`}>
                    <Link
                      to={a.href}
                      onClick={() => setOpen(false)}
                      className="flex gap-2 rounded-lg px-3 py-2 hover:bg-slate-50"
                    >
                      {a.severity === "error" ? (
                        <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                      )}
                      <span className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{a.title}</p>
                        <p className="text-xs text-slate-500 truncate">{a.message}</p>
                      </span>
                    </Link>
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
