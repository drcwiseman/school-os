import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plug, Package, ArrowRight } from "lucide-react";
import { api } from "../api/client";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

const CATEGORY_LABELS: Record<string, string> = {
  payments: "Payments",
  communications: "Communications",
  productivity: "Productivity",
  accounting: "Accounting",
  analytics: "Analytics",
  education: "Education",
};

export const AddonMarketplace: React.FC = () => {
  const [addons, setAddons] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/platform/addons"),
      api.get("/api/platform/integrations/catalog"),
    ])
      .then(([a, i]) => {
        setAddons(a.data ?? []);
        setIntegrations(i.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 pb-8">
      <div className={`${CARD} p-5`}>
        <h1 className="text-lg font-bold text-slate-900">Marketplace</h1>
        <p className="text-xs text-slate-500 mt-1">
          Paid add-ons and third-party integrations. Activate add-ons per school on the school detail page.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
          <Package size={16} className="text-blue-600" />
          Paid add-ons
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {addons.map((a) => (
            <article key={a.id} className={`${CARD} p-4`}>
              <p className="font-semibold text-slate-900">{a.name}</p>
              <p className="text-xs font-mono text-slate-500 mt-1">{a.code}</p>
              {a.description && <p className="text-sm text-slate-600 mt-2">{a.description}</p>}
            </article>
          ))}
        </div>
        <Link to="/platform/tenants" className="text-sm text-blue-600 font-medium mt-3 inline-flex items-center gap-1">
          Manage per school <ArrowRight size={14} />
        </Link>
      </section>

      <section>
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
          <Plug size={16} className="text-blue-600" />
          Integration catalog
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Popular systems that enhance SchoolOS — payments, email, accounting, and analytics. Contact engineering to enable connectors per tenant.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map((i) => (
            <article key={i.code} className={`${CARD} p-4 flex flex-col`}>
              <div className="flex justify-between items-start">
                <p className="font-semibold text-slate-900">{i.name}</p>
                {i.popular && (
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">Popular</span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 uppercase mt-1">{CATEGORY_LABELS[i.category] ?? i.category}</p>
              <p className="text-sm text-slate-600 mt-2 flex-1">{i.description}</p>
              <ul className="mt-2 text-[11px] text-slate-500 space-y-0.5">
                {(i.benefits ?? []).slice(0, 2).map((b: string) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
