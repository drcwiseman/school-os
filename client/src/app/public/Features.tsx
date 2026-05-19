import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { PageHero } from "./components/PageHero";
import { FEATURE_TABS } from "./data/marketing";

export const Features: React.FC = () => {
  const [active, setActive] = useState(FEATURE_TABS[0].id);
  const tab = FEATURE_TABS.find((t) => t.id === active) ?? FEATURE_TABS[0];

  return (
    <>
      <PageHero
        eyebrow="15 integrated phases"
        title="Capabilities without the clutter"
        subtitle="Explore modules by domain — each designed for clarity, auditability, and scale across single campuses and district networks."
      />

      <section className="section-pad">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap justify-center gap-2">
            {FEATURE_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                  active === t.id
                    ? "bg-marketing-accent text-white shadow-marketing"
                    : "border border-marketing-navy/10 bg-white text-marketing-navy/70 hover:border-marketing-sage/40"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div id={tab.id} className="mt-16 grid items-center gap-14 lg:grid-cols-2">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-marketing-sage/12 text-marketing-sage">
                <tab.icon className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h2 className="mkt-heading-lg mt-6">{tab.title}</h2>
              <p className="mkt-body mt-4">{tab.description}</p>
              <ul className="mt-8 space-y-3.5">
                {tab.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm text-marketing-navy/80">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-marketing-sage/15">
                      <Check className="h-3 w-3 text-marketing-sage" strokeWidth={2.5} />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-10 rounded-2xl border border-marketing-accent/15 bg-gradient-to-br from-marketing-accent/8 to-transparent p-6">
                <p className="font-heading text-4xl font-bold text-marketing-accent">{tab.metric.value}</p>
                <p className="mt-2 text-sm text-marketing-navy/65">{tab.metric.label}</p>
              </div>
            </div>
            <div className="glass-card-elevated flex aspect-[4/3] items-center justify-center p-10">
              <div className="text-center">
                <tab.icon className="mx-auto h-20 w-20 text-marketing-sage/25" strokeWidth={1} />
                <p className="mt-5 font-display text-xl text-marketing-navy/70">{tab.label}</p>
                <p className="mt-2 text-sm text-marketing-navy/45">Live workspace from your SchoolOS deployment</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mkt-stat-band">
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <p className="font-display text-5xl font-semibold md:text-6xl">5,000+</p>
          <p className="mt-3 text-lg text-marketing-cream/85">sequential student invoices in under 12 seconds</p>
          <p className="mx-auto mt-5 max-w-lg text-sm text-marketing-cream/55">
            Finance teams process bulk billing without leaving the platform.
          </p>
          <Link to="/contact" className="btn-mkt-secondary relative mt-10 border-white/25 bg-white text-marketing-navy">
            Schedule a finance walkthrough <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </>
  );
};
