import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { PageHero } from "./components/PageHero";
import { FeatureTabScene } from "./components/MktIllustrations";
import { Reveal } from "./components/Reveal";
import { FEATURE_TABS, POWERFUL_FEATURES } from "./data/marketing";

export const Features: React.FC = () => {
  const [active, setActive] = useState(FEATURE_TABS[0].id);
  const tab = FEATURE_TABS.find((t) => t.id === active) ?? FEATURE_TABS[0];

  return (
    <>
      <PageHero
        eyebrow="All-in-one school ERP"
        title="Powerful features for every department"
        subtitle="Explore modules by domain — academics, finance, HR, and operations with illustrated workflows and audit-ready controls."
      />

      <section className="section-pad mkt-section-soft">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="flex flex-wrap justify-center gap-2">
              {FEATURE_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActive(t.id)}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${
                    active === t.id
                      ? "bg-marketing-primary text-white shadow-marketing"
                      : "border border-marketing-navy/10 bg-white text-marketing-navy/70 hover:border-marketing-primary/30 hover:text-marketing-primary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </Reveal>

          <div key={tab.id} className="mkt-tab-panel mt-16 grid items-center gap-14 lg:grid-cols-2">
            <Reveal>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-marketing-primary/20 to-marketing-soft text-marketing-primary">
                <tab.icon className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h2 className="mkt-heading-lg mt-6">{tab.title}</h2>
              <p className="mkt-body mt-4">{tab.description}</p>
              <ul className="mt-8 space-y-3.5">
                {tab.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm text-marketing-navy/80">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-marketing-primary/15">
                      <Check className="h-3 w-3 text-marketing-primary" strokeWidth={2.5} />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-10 rounded-2xl border border-marketing-primary/15 bg-gradient-to-br from-marketing-primary/8 to-transparent p-6">
                <p className="font-heading text-4xl font-bold text-marketing-primary">{tab.metric.value}</p>
                <p className="mt-2 text-sm text-marketing-navy/65">{tab.metric.label}</p>
              </div>
            </Reveal>
            <Reveal delayMs={100}>
              <FeatureTabScene tabId={tab.id} />
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section-pad mkt-section-alt">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="mkt-heading-lg">More capabilities included</h2>
            <p className="mkt-body mt-4">The same rich module set schools expect from leading ERP products.</p>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {POWERFUL_FEATURES.map((f, i) => (
              <Reveal key={f.title} delayMs={i * 40}>
                <article className="mkt-feature-tile h-full">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-marketing-primary/10 text-marketing-primary">
                    <f.icon className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="mt-3 font-heading text-sm font-bold text-marketing-navy">{f.title}</h3>
                  <p className="mt-1.5 text-xs text-marketing-navy/55">{f.description}</p>
                </article>
              </Reveal>
            ))}
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
