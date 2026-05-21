import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Home, Loader2 } from "lucide-react";

const TABS = ["houses", "rooms", "allocations", "occupancy", "visitors", "attendance", "meals", "disciplinary", "welfare"] as const;

export const BoardingOps: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>("occupancy");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    const base = `/s/${schoolSlug}/api/boarding`;
    const path = tab === "welfare" ? "welfare-notes" : tab === "occupancy" ? "occupancy" : tab === "disciplinary" ? "disciplinary" : tab;
    api.get(`${base}/${path}`).then((r) => setData(r.data)).catch((e) => toast(e.message, "error")).finally(() => setLoading(false));
  }, [schoolSlug, tab]);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><Home className="w-7 h-7 text-violet-400" /> Hostel / Boarding</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => <button key={t} type="button" className={`tab-pill ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {loading ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-500" /> : (
        <div className="card p-5">
          {tab === "occupancy" && data && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-slate-500 text-sm">Rooms</p><p className="text-2xl font-bold text-white">{data.rooms}</p></div>
              <div><p className="text-slate-500 text-sm">Capacity</p><p className="text-2xl font-bold text-white">{data.capacity}</p></div>
              <div><p className="text-slate-500 text-sm">Occupied</p><p className="text-2xl font-bold text-white">{data.occupied}</p></div>
              <div><p className="text-slate-500 text-sm">Occupancy</p><p className="text-2xl font-bold text-emerald-400">{data.pct}%</p></div>
            </div>
          )}
          {tab !== "occupancy" && Array.isArray(data) && data.map((row: any) => (
            <p key={row.id} className="text-slate-300 text-sm py-1 border-b border-slate-800">{JSON.stringify(row).slice(0, 120)}…</p>
          ))}
        </div>
      )}
    </div>
  );
};
