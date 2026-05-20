import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { SeoHead } from "./components/SeoHead";
import { PageHero } from "./components/PageHero";
import { Plug, ArrowRight } from "lucide-react";

type Integration = {
  code: string;
  name: string;
  description: string;
  category: string;
  benefits: string[];
  popular?: boolean;
};

const CATEGORY_LABELS: Record<string, string> = {
  payments: "Payments",
  communications: "Communications",
  productivity: "Productivity",
  accounting: "Accounting",
  analytics: "Analytics",
  education: "Education",
};

export const IntegrationsPage: React.FC = () => {
  const [items, setItems] = useState<Integration[]>([]);

  useEffect(() => {
    api.get("/api/public/integrations").then((r) => setItems(r.data ?? [])).catch(() => {});
  }, []);

  const grouped = items.reduce<Record<string, Integration[]>>((acc, i) => {
    const c = i.category || "productivity";
    if (!acc[c]) acc[c] = [];
    acc[c].push(i);
    return acc;
  }, {});

  return (
    <>
      <SeoHead
        title="Integrations — SchoolOS connects to your stack"
        description="MTN MoMo, WhatsApp, Google Workspace, QuickBooks, Flutterwave, and more. Enhance your school ERP with proven integrations."
        keywords="school ERP integrations, MTN MoMo school fees, WhatsApp school, QuickBooks schools"
      />
      <PageHero
        eyebrow="Integrations"
        title="Connect SchoolOS to tools you already use"
        subtitle="Payments, email, accounting, and analytics — one platform, many connectors."
      />
      <section className="marketing-container py-16 space-y-12">
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat}>
            <h2 className="text-xl font-bold text-white mb-4">{CATEGORY_LABELS[cat] ?? cat}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((i) => (
                <article key={i.code} className="marketing-card p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <Plug className="w-5 h-5 text-indigo-400 shrink-0" />
                    {i.popular && (
                      <span className="text-[10px] font-bold uppercase text-emerald-400">Popular</span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-white mt-2">{i.name}</h3>
                  <p className="text-sm text-slate-400 mt-1 flex-1">{i.description}</p>
                  <ul className="mt-3 space-y-1 text-xs text-slate-500">
                    {i.benefits.slice(0, 3).map((b) => (
                      <li key={b}>• {b}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        ))}
        <div className="text-center pt-8">
          <Link to="/contact" className="marketing-btn-primary inline-flex items-center gap-2">
            Request an integration <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
};
