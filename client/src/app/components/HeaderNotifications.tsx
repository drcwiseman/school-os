import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Bell, MessageSquare, Megaphone } from "lucide-react";
import { useAuth } from "../state/AuthContext";

type Counts = { unreadMessages: number; auditToday: number; scheduledAnnouncements: number };

export const HeaderNotifications: React.FC = () => {
  const { schoolSlug, hasPermission } = useAuth();
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    if (!schoolSlug) return;
    api.get(`/s/${schoolSlug}/api/dashboard/notifications`)
      .then((r) => setCounts(r.data ?? null))
      .catch(() => setCounts(null));
    const t = setInterval(() => {
      api.get(`/s/${schoolSlug}/api/dashboard/notifications`).then((r) => setCounts(r.data ?? null)).catch(() => {});
    }, 60_000);
    return () => clearInterval(t);
  }, [schoolSlug]);

  if (!counts) return null;

  const items = [
    { n: counts.unreadMessages, label: "Parent messages", icon: MessageSquare, to: `/s/${schoolSlug}/teacher`, show: hasPermission("academics.view") },
    { n: counts.scheduledAnnouncements, label: "Scheduled posts", icon: Megaphone, to: `/s/${schoolSlug}/messaging`, show: hasPermission("messaging.view") },
    { n: counts.auditToday, label: "Audit today", icon: Bell, to: `/s/${schoolSlug}/admin`, show: hasPermission("audit.view") },
  ].filter((i) => i.show && i.n > 0);

  if (!items.length) return null;

  return (
    <div className="flex items-center gap-2">
      {items.map(({ n, label, icon: Icon, to }) => (
        <Link
          key={to}
          to={to}
          className="relative inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 hover:text-white"
          title={label}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}</span>
          <span className="min-w-[1.25rem] rounded-full bg-primary-600 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">{n}</span>
        </Link>
      ))}
    </div>
  );
};
