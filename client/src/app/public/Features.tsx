import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { FEATURE_TABS } from "./data/marketing";

export const Features: React.FC = () => {
  const [active, setActive] = useState(FEATURE_TABS[0].id);
  const tab = FEATURE_TABS.find((t) => t.id === active) ?? FEATURE_TABS[0];

  return (
    <>
      <section className="section-pad border-b border-marketing-navy/10 bg-gradient-to-b from-white to-marketing-cream">
        <div className="mx-auto max-w-7xl text-center">
          <p className="section-label">15 integrated phases</p>
          <h1 className="heading-xl mt-3">Capabilities without the clutter</h1>
          <p className="body-lg mx-auto mt-6 max-w-2xl">
            Explore modules by domain — each designed for clarity, auditability, and scale across single campuses and district networks.
          </p>
        </div>
      </section>

      <section className="section-pad">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap justify-center gap-2">
            {FEATURE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                className={`rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
                  active === t.id
                    ? "bg-marketing-navy text-marketing-cream shadow-marketing"
                    : "bg-white text-marketing-navy/70 hover:bg-marketing-cream-dark"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div id={tab.id} className="mt-14 grid items-center gap-12 lg:grid-cols-2">
            <div className="animate-fade-up">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-marketing-sage/15 text-marketing-sage">
                <tab.icon className="h-7 w-7" />
              </div>
              <h2 className="heading-lg mt-6">{tab.title}</h2>
              <p className="mt-4 text-marketing-navy/75 leading-relaxed">{tab.description}</p>
              <ul className="mt-8 space-y-3">
                {tab.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm text-marketing-navy/80">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-marketing-sage" />
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-10 rounded-2xl border border-marketing-burgundy/20 bg-marketing-burgundy/5 p-6">
                <p className="font-display text-4xl font-semibold text-marketing-burgundy">{tab.metric.value}</p>
                <p className="mt-1 text-sm text-marketing-navy/70">{tab.metric.label}</p>
              </div>
            </div>
            <div className="glass-card aspect-[4/3] flex items-center justify-center p-8 shadow-marketing-lg">
              <div className="text-center">
                <tab.icon className="mx-auto h-16 w-16 text-marketing-sage/40" />
                <p className="mt-4 font-display text-lg text-marketing-navy/60">{tab.label} workspace preview</p>
                <p className="mt-2 text-xs text-marketing-navy/40">Interactive UI from your deployed SchoolOS instance</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-pad bg-marketing-navy text-marketing-cream">
        <div className="mx-auto max-w-7xl text-center">
          <p className="font-display text-5xl font-semibold md:text-6xl">5,000+</p>
          <p className="mt-2 text-lg text-marketing-cream/80">sequential student invoices in under 12 seconds</p>
          <p className="mx-auto mt-6 max-w-xl text-sm text-marketing-cream/60">
            Finance teams process bulk billing without leaving the platform — no CSV gymnastics, no overnight scripts.
          </p>
          <Link to="/contact" className="btn-marketing-secondary mt-10 border-white/30 bg-white/10 text-white hover:bg-white hover:text-marketing-navy">
            Schedule a finance walkthrough <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
};
