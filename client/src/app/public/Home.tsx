import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Play } from "lucide-react";
import { HeroVisual } from "./components/HeroVisual";
import { HeroFloatingChips, OfferingMiniScene, RoleAvatar } from "./components/MktIllustrations";
import { Reveal } from "./components/Reveal";
import {
  ACADEMIC_LEARNING,
  HOME_MODULE_TABS,
  POWERFUL_FEATURES,
  ROLE_FEATURES,
  SOCIAL_PROOF,
  UNIQUE_OFFERING,
} from "./data/marketing";

const HERO_CHECKS = [
  "Multi-tenant data isolation",
  "Parent & student portals",
  "Finance, HR & academics unified",
] as const;

export const MarketingHome: React.FC = () => {
  const [moduleTab, setModuleTab] = useState<(typeof HOME_MODULE_TABS)[number]["id"]>(HOME_MODULE_TABS[0].id);
  const activeModule = HOME_MODULE_TABS.find((t) => t.id === moduleTab) ?? HOME_MODULE_TABS[0];

  return (
    <>
      <section className="mkt-hero">
        <HeroFloatingChips />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <p className="mkt-eyebrow mkt-eyebrow-blue">All-in-one school ERP</p>
            <h1 className="mkt-heading-xl mt-5">
              The school management system for{" "}
              <span className="mkt-gradient-text">modern institutions</span>
            </h1>
            <p className="mkt-body mt-6 max-w-lg">
              One application for the whole school — reduce operational complexity, increase transparency,
              and make data-driven decisions across academics, finance, and parent engagement.
            </p>
            <ul className="mt-8 space-y-2.5">
              {HERO_CHECKS.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm font-medium text-marketing-navy/70">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-marketing-primary/15">
                    <Check className="h-3 w-3 text-marketing-primary" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link to="/contact" className="btn-mkt-primary group bg-marketing-primary hover:bg-marketing-primary-light">
                Explore now
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link to="/features" className="btn-mkt-secondary group">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-marketing-soft transition-colors group-hover:bg-marketing-primary/10">
                  <Play className="h-4 w-4 text-marketing-primary" />
                </span>
                See features
              </Link>
            </div>
          </Reveal>

          <Reveal delayMs={120} className="relative flex justify-center lg:justify-end">
            <HeroVisual />
          </Reveal>
        </div>
      </section>

      <section className="border-y border-marketing-navy/5 bg-white py-14">
        <Reveal className="mx-auto max-w-6xl px-5 lg:px-8">
          <p className="text-center text-xs font-bold uppercase tracking-[0.3em] text-marketing-navy/40">
            Trusted by forward-thinking institutions
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
            {SOCIAL_PROOF.map((name) => (
              <span
                key={name}
                className="font-heading text-lg font-semibold text-marketing-navy/25 transition-colors duration-300 hover:text-marketing-primary/50"
              >
                {name}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Why unique — TSMS “Smart Solution” block */}
      <section className="section-pad mkt-section-soft">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="mkt-eyebrow mkt-eyebrow-blue">{UNIQUE_OFFERING.eyebrow}</p>
            <h2 className="mkt-heading-lg mt-5">{UNIQUE_OFFERING.title}</h2>
            <p className="mkt-body mt-4">{UNIQUE_OFFERING.subtitle}</p>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {UNIQUE_OFFERING.items.map((item, i) => (
              <Reveal key={item.title} delayMs={i * 80}>
                <article className="mkt-pillar-card h-full text-center">
                  <OfferingMiniScene kind={item.illustration} />
                  <div className="mx-auto mt-4 flex h-12 w-12 items-center justify-center rounded-xl bg-marketing-primary/10 text-marketing-primary">
                    <item.icon className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="mt-4 font-heading text-lg font-bold text-marketing-navy">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-marketing-navy/60">{item.description}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Role-based features grid */}
      <section className="section-pad mkt-section-alt">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="mkt-eyebrow mkt-eyebrow-blue">Role-based access</p>
            <h2 className="mkt-heading-lg mt-5">Exclusive features for every role</h2>
            <p className="mkt-body mt-4">
              Dedicated workspaces for administrators, teachers, parents, finance, transport, and more —
              all under one secure platform.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ROLE_FEATURES.map((r, i) => (
              <Reveal key={r.role} delayMs={(i % 4) * 60}>
                <article className="mkt-role-card h-full text-center">
                  <RoleAvatar icon={r.icon} tone={r.tone} />
                  <h3 className="mt-5 font-heading text-base font-bold text-marketing-navy">{r.role}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-marketing-navy/55">{r.description}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Powerful features grid */}
      <section className="section-pad mkt-section-soft">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="mkt-eyebrow mkt-eyebrow-blue">Powerful features</p>
            <h2 className="mkt-heading-lg mt-5">Why choose SchoolOS?</h2>
            <p className="mkt-body mt-4">
              Smart features designed to make school management easier, faster, and more efficient.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {POWERFUL_FEATURES.map((f, i) => (
              <Reveal key={f.title} delayMs={i * 40}>
                <article className="mkt-feature-tile h-full">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-marketing-primary/15 to-marketing-soft text-marketing-primary transition-transform duration-300 group-hover:scale-105">
                    <f.icon className="h-7 w-7" strokeWidth={1.5} />
                  </div>
                  <h3 className="mt-4 font-heading text-sm font-bold text-marketing-navy">{f.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-marketing-navy/55">{f.description}</p>
                </article>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-12 text-center" delayMs={120}>
            <Link to="/features" className="btn-mkt-primary group">
              View all modules
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Tabbed core modules preview */}
      <section className="section-pad mkt-section-alt">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="mkt-eyebrow mkt-eyebrow-blue">Core modules</p>
            <h2 className="mkt-heading-lg mt-5">Everything to run your school smarter</h2>
            <p className="mkt-body mt-4">Academic, administration, accounting, and examinations — explore by domain.</p>
          </Reveal>
          <Reveal className="mt-10" delayMs={80}>
            <div className="flex flex-wrap justify-center gap-2">
              {HOME_MODULE_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setModuleTab(t.id)}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${
                    moduleTab === t.id
                      ? "bg-marketing-primary text-white shadow-marketing"
                      : "border border-marketing-navy/10 bg-white text-marketing-navy/70 hover:border-marketing-primary/30 hover:text-marketing-primary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div key={moduleTab} className="mkt-tab-panel mt-10 grid items-center gap-10 lg:grid-cols-2">
              <div className="glass-card-elevated p-8 lg:p-10">
                <h3 className="font-heading text-2xl font-bold text-marketing-navy">{activeModule.label}</h3>
                <ul className="mt-6 space-y-3">
                  {activeModule.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-marketing-navy/75">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marketing-primary/15">
                        <Check className="h-3.5 w-3.5 text-marketing-primary" strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/features" className="btn-mkt-secondary mt-8 inline-flex">
                  Explore {activeModule.label} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-marketing-soft to-white p-6 shadow-marketing-lg">
                <div className="grid grid-cols-2 gap-3">
                  {activeModule.features.map((f, i) => (
                    <div
                      key={f}
                      className="rounded-xl border border-marketing-primary/10 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-marketing"
                      style={{ transitionDelay: `${i * 50}ms` }}
                    >
                      <p className="text-xs font-bold text-marketing-primary">{String(i + 1).padStart(2, "0")}</p>
                      <p className="mt-1 font-heading text-sm font-semibold text-marketing-navy">{f}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section-pad mkt-section-soft">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="mkt-eyebrow mkt-eyebrow-blue">{ACADEMIC_LEARNING.eyebrow}</p>
            <h2 className="mkt-heading-lg mt-5">{ACADEMIC_LEARNING.title}</h2>
            <p className="mkt-body mt-4">{ACADEMIC_LEARNING.subtitle}</p>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ACADEMIC_LEARNING.modules.map((m, i) => (
              <Reveal key={m.title} delayMs={i * 50}>
                <article className="glass-card h-full p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-marketing-lg">
                  <h3 className="font-heading text-base font-bold text-marketing-navy">{m.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-marketing-navy/60">{m.description}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="product-video" className="section-pad mkt-section-alt">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="mkt-eyebrow mkt-eyebrow-blue">Product tour</p>
          <h2 className="mkt-heading-lg mt-5">See SchoolOS in motion</h2>
          <p className="mkt-body mt-4">
            A concise walkthrough of dashboards, report generation, and parent portals.
          </p>
          <div className="mkt-video-card group mt-10">
            <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-marketing-soft to-white">
              <button
                type="button"
                className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-marketing-lg ring-4 ring-marketing-primary/20 transition-transform duration-300 group-hover:scale-105"
                aria-label="Play video"
              >
                <Play className="ml-1 h-8 w-8 text-marketing-primary" fill="currentColor" />
              </button>
            </div>
            <p className="border-t border-marketing-navy/5 py-4 text-sm text-marketing-navy/50">
              Embed your Loom or Vimeo URL here
            </p>
          </div>
        </Reveal>
      </section>

      <section className="mkt-stat-band">
        <Reveal className="relative mx-auto max-w-3xl px-5 text-center">
          <p className="font-heading text-5xl font-bold md:text-6xl">15+</p>
          <p className="mt-3 text-xl font-medium text-white/90">integrated operational modules</p>
          <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-white/55">
            From admissions to payroll — one coherent system with strict per-school data isolation.
          </p>
          <Link
            to="/contact"
            className="btn-mkt-secondary relative mt-10 border-white/30 bg-white text-marketing-navy hover:shadow-marketing-lg"
          >
            Book your walkthrough <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </section>
    </>
  );
};
