import { useCallback, useEffect, useState } from "react";
import { api } from "../../../api/client";
import { Bus, MapPin, Loader2 } from "lucide-react";

type TransportData = {
  routeName?: string;
  routeId?: string;
  stopId?: string;
  stops?: { name: string; orderNo: number }[];
  vehicleLocation?: { lat?: number; lng?: number; recordedAt?: string } | null;
};

export function StudentTransportPanel({
  schoolSlug,
  initial,
}: {
  schoolSlug: string;
  initial: TransportData | null;
}) {
  const [transport, setTransport] = useState<TransportData | null>(initial);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!initial?.routeId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (initial.routeId) q.set("routeId", initial.routeId);
      const res = await api.get(`/s/${schoolSlug}/api/portal/transport-map?${q.toString()}`);
      const d = res.data;
      setTransport((t) => ({
        routeName: d?.route?.name ?? t?.routeName ?? initial.routeName,
        routeId: initial.routeId,
        stops: d?.stops ?? t?.stops ?? initial.stops,
        vehicleLocation: d?.vehicleLocation ?? null,
      }));
    } catch {
      setTransport(initial);
    } finally {
      setLoading(false);
    }
  }, [schoolSlug, initial]);

  useEffect(() => {
    if (initial?.routeId) load();
    else setTransport(initial);
  }, [initial, load]);

  if (!transport?.routeName) {
    return (
      <p className="portal-empty text-sm">
        You are not assigned to a bus route. Contact the school office if you expect transport.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-[var(--portal-fg-strong)] flex items-center gap-2">
        <Bus className="w-4 h-4 portal-accent-text" />
        Route: {transport.routeName}
      </p>
      {loading && (
        <p className="text-xs text-[var(--portal-subtle)] flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Updating map…
        </p>
      )}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider portal-accent-text mb-2">Stops</p>
        <ul className="text-sm text-[var(--portal-muted)] space-y-1">
          {(transport.stops ?? []).map((s, i) => (
            <li key={i} className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 shrink-0 portal-accent-text" />
              {s.orderNo}. {s.name}
            </li>
          ))}
          {!(transport.stops ?? []).length && <li className="portal-empty">No stops listed.</li>}
        </ul>
      </div>
      {transport.vehicleLocation && (
        <p className="text-xs text-[var(--portal-subtle)]">
          Last bus location: {transport.vehicleLocation.recordedAt
            ? new Date(transport.vehicleLocation.recordedAt).toLocaleString()
            : "recent"}
        </p>
      )}
    </div>
  );
}
