import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { Bus, Loader2, MapPin } from "lucide-react";

const TABS = ["routes", "stops", "vehicles", "drivers", "gps", "fuel", "maintenance", "assignments"] as const;

export const TransportOps: React.FC = () => {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const { toast } = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]>("routes");
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState<any[]>([]);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [stops, setStops] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [gps, setGps] = useState<any[]>([]);
  const [fuel, setFuel] = useState<any[]>([]);
  const [maint, setMaint] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [mapData, setMapData] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const base = `/s/${schoolSlug}/api/transport`;
    try {
      if (tab === "routes") setRoutes((await api.get(`${base}/routes`)).data ?? []);
      if (tab === "stops" && selectedRoute) setStops((await api.get(`${base}/routes/${selectedRoute}/stops`)).data ?? []);
      if (tab === "vehicles") setVehicles((await api.get(`${base}/vehicles`)).data ?? []);
      if (tab === "drivers") setDrivers((await api.get(`${base}/drivers`)).data ?? []);
      if (tab === "gps") {
        setGps((await api.get(`${base}/gps/live`)).data ?? []);
        setMapData((await api.get(`${base}/map-data`)).data);
      }
      if (tab === "fuel") setFuel((await api.get(`${base}/fuel`)).data ?? []);
      if (tab === "maintenance") setMaint((await api.get(`${base}/maintenance`)).data ?? []);
      if (tab === "assignments") setAssignments((await api.get(`${base}/assignments`)).data ?? []);
    } catch (e: any) { toast(e.message, "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (schoolSlug) api.get(`/s/${schoolSlug}/api/transport/routes`).then((r) => setRoutes(r.data ?? [])).catch(() => {});
  }, [schoolSlug]);

  useEffect(() => { load(); }, [schoolSlug, tab, selectedRoute]);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2"><Bus className="w-7 h-7 text-amber-400" /> Transport</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => <button key={t} type="button" className={`tab-pill ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === "stops" && (
        <select className="input max-w-xs" value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)}>
          <option value="">Select route…</option>
          {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      )}
      {loading ? <Loader2 className="w-8 h-8 animate-spin text-slate-500 mx-auto" /> : (
        <div className="card p-5 space-y-2">
          {tab === "routes" && routes.map((r) => <p key={r.id} className="text-slate-300">{r.name}</p>)}
          {tab === "stops" && stops.map((s) => <p key={s.id} className="text-slate-300 flex items-center gap-1"><MapPin className="w-3 h-3" />{s.name} {s.lat && `(${s.lat}, ${s.lng})`}</p>)}
          {tab === "vehicles" && vehicles.map((v) => <p key={v.id} className="text-slate-300">{v.registration}</p>)}
          {tab === "drivers" && drivers.map((d) => <p key={d.id} className="text-slate-300">{d.name} · {d.phone ?? "—"}</p>)}
          {tab === "gps" && (
            <>
              {gps.map((g: any) => <p key={g.vehicle.id} className="text-slate-300">{g.vehicle.registration}: {g.ping.lat}, {g.ping.lng}</p>)}
              {mapData?.stops?.length > 0 && <p className="text-xs text-slate-500">{mapData.stops.length} stops on map</p>}
            </>
          )}
          {tab === "fuel" && fuel.map((f) => <p key={f.id} className="text-slate-300">{f.liters}L · vehicle {f.vehicleId.slice(0, 8)}</p>)}
          {tab === "maintenance" && maint.map((m) => <p key={m.id} className="text-slate-300">{m.description} · {m.serviceDate}</p>)}
          {tab === "assignments" && assignments.map((a) => <p key={a.id} className="text-slate-300 font-mono text-xs">Student {a.studentId.slice(0, 8)} → route {a.routeId.slice(0, 8)}</p>)}
        </div>
      )}
    </div>
  );
};
