import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { DashboardMockup } from "./components/DashboardMockup";
import { PILLARS, SOCIAL_PROOF } from "./data/marketing";

export const MarketingHome: React.FC = () => (
  <>
    <section className="mkt-hero">
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div className="animate-fade-up">
          <span className="mkt-eyebrow">
            <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
            Multi-portal school management
          </span>
          <h1 className="mkt-heading-xl mt-6">
            The Operating System for{" "}
            <span className="text-marketing-burgundy">Modern Academy</span> Management
          </h1>
          <p className="mkt-body mt-6 max-w-xl">
            One elegant platform for administrators, parents, and students — with absolute tenant
            isolation, flawless auditing, and every operational module your institution needs.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link to="/contact" className="btn-mkt-primary">
              Request Live Demo <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#product-video" className="btn-mkt-secondary">
              <Play className="h-4 w-4 fill-marketing-navy/20" /> Watch 2-Min Overview
            </a>
          </div>
          <p className="mt-8 text-sm text-marketing-navy/50">
            Trusted by principals who refuse fragmented spreadsheets and leaky legacy systems.
          </p>
        </div>
        <div className="animate-fade-up mkt-delay-2 relative flex justify-center lg:justify-end">
          <DashboardMockup />
        </div>
      </div>
    </section>

    <section className="border-y border-marketing-navy/[0.06] bg-white py-12">
      <div className="mx-auto max-w-7xl px-5 md:px-10">
        <p className="text-center text-[11px] font-bold uppercase tracking-[0.28em] text-marketing-navy/45">
          Trusted by forward-thinking institutions
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 md:gap-x-14">
          {SOCIAL_PROOF.map((name) => (
            <span key={name} className="font-display text-lg font-medium text-marketing-navy/30 md:text-xl">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>

    <section className="section-pad">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-2xl text-center">
          <span className="mkt-eyebrow">Architectural excellence</span>
          <h2 className="mkt-heading-lg mt-6">Built on three unshakeable pillars</h2>
          <p className="mkt-body mt-4">
            Enterprise-grade foundations designed for school boards, regulators, and IT directors who demand proof — not promises.
          </p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-3 md:gap-8">
          {PILLARS.map((p, i) => (
            <article key={p.title} className="mkt-pillar-card" style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-marketing-burgundy/15 to-marketing-sage/10 text-marketing-burgundy">
                <p.icon className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold text-marketing-navy">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-marketing-navy/65">{p.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-14 text-center">
          <Link to="/features" className="btn-mkt-primary">
            Explore all modules <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>

    <section id="product-video" className="section-pad bg-marketing-cream-dark/60">
      <div className="mx-auto max-w-3xl text-center">
        <span className="mkt-eyebrow">Product tour</span>
        <h2 className="mkt-heading-lg mt-6">See SchoolOS in motion</h2>
        <p className="mkt-body mt-4">
          A concise walkthrough of dashboards, report generation, and parent portals.
        </p>
        <div className="glass-card-elevated mt-10 flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-marketing-navy/5 to-marketing-sage/10">
          <div className="text-center px-6">
            <Play className="mx-auto h-14 w-14 rounded-full bg-marketing-navy/10 p-4 text-marketing-navy" />
            <p className="mt-4 text-sm font-medium text-marketing-navy/55">
              Embed your Loom or Vimeo URL here
            </p>
          </div>
        </div>
      </div>
    </section>

    <section className="mkt-stat-band">
      <div className="relative mx-auto max-w-3xl px-5 text-center">
        <p className="font-display text-5xl font-semibold md:text-6xl">15+</p>
        <p className="mt-2 text-xl text-marketing-cream/90">integrated operational modules</p>
        <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-marketing-cream/55">
          From admissions to payroll — one coherent system with strict per-school data isolation.
        </p>
        <Link to="/contact" className="btn-mkt-secondary relative mt-10 border-white/25 bg-white text-marketing-navy hover:border-white">
          Book your walkthrough <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  </>
);
