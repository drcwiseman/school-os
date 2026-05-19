import React, { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";
import { formatMoneyMinor, COUNTRY_OPTIONS } from "../../../lib/currencies";

export const PlanManager: React.FC = () => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [country, setCountry] = useState("KE");
  const [currency, setCurrency] = useState("KES");

  const load = async () => {
    const res = await api.get(`/api/platform/plans?country=${country}&currency=${currency}`);
    setPlans(res.data ?? []);
  };

  useEffect(() => {
    load().catch((e) => toast(e.message, "error"));
  }, [country, currency]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers size={22} className="text-blue-400" /> SaaS plans & geo pricing
          </h2>
          <p className="text-xs text-slate-400 mt-1">Prices resolve by country → currency → global fallback. FX conversions use frankfurter.app (free).</p>
        </div>
        <div className="flex gap-2">
          <select className="bg-[#060a12] border border-slate-800 text-xs rounded-lg px-3 py-2" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Global (*)</option>
            {COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          <select className="bg-[#060a12] border border-slate-800 text-xs rounded-lg px-3 py-2" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {["KES", "USD", "EUR", "GBP", "NGN", "ZAR", "INR", "AED"].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {plans.map((p) => {
          const resolved = p.resolvedPrice ?? { priceMonthly: p.priceMonthly, currency, source: "base" };
          const features = (p.featuresJson ?? {}) as Record<string, boolean>;
          return (
            <div key={p.id} className="bg-[#090f1c] border border-slate-900 rounded-xl p-6">
              <span className="text-[10px] uppercase text-blue-400 font-bold">{p.code}</span>
              <h3 className="text-lg font-bold text-white mt-1">{p.name}</h3>
              <p className="text-2xl font-extrabold text-emerald-400 mt-2">
                {formatMoneyMinor(resolved.priceMonthly, resolved.currency)}
                <span className="text-xs text-slate-500 font-normal"> / mo</span>
              </p>
              <p className="text-[10px] text-slate-500 mt-1">Source: {resolved.source} · {country || "*"} / {currency}</p>
              <ul className="mt-4 space-y-1 text-xs text-slate-400">
                {Object.entries(features).map(([k, v]) => (
                  <li key={k} className={v ? "text-emerald-400/90" : "text-slate-600"}>{k.replace(/_/g, " ")}: {v ? "on" : "off"}</li>
                ))}
              </ul>
              {(p.regionalPrices ?? []).length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500">
                  {(p.regionalPrices as any[]).slice(0, 4).map((r) => (
                    <div key={r.id}>{r.countryCode}/{r.currency}: {formatMoneyMinor(r.priceMonthly, r.currency)}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
