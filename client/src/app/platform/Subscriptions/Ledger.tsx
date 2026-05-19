import React, { useEffect, useState } from "react";
import { api } from "../../api/client";
import { formatMoneyMinor } from "../../../lib/currencies";

export const RevenueLedger: React.FC = () => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get("/api/platform/stats").then((s) => setStats(s.data));
  }, []);

  const cur = stats?.displayCurrency ?? "USD";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Global revenue ledger</h2>
      <p className="text-xs text-slate-400">Consolidated payment volume converted to platform display currency via live FX.</p>
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat label="Total volume (ARR proxy)" value={formatMoneyMinor(stats?.totalRevenue ?? 0, cur)} />
        <Stat label="MRR estimate" value={formatMoneyMinor(stats?.mrr ?? 0, cur)} />
        <Stat label="Active billable schools" value={String(stats?.activeTenants ?? 0)} />
      </div>
      <p className="text-xs text-slate-500">Per-tenant invoicing & defaulters view — Phase 17 billing module.</p>
    </div>
  );
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#090f1c] border border-slate-900 rounded-xl p-5">
      <p className="text-xs text-slate-500 uppercase">{label}</p>
      <p className="text-2xl font-bold text-white mt-2">{value}</p>
    </div>
  );
}
