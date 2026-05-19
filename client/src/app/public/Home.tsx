import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import { DashboardMockup } from "./components/DashboardMockup";
import { PILLARS, SOCIAL_PROOF } from "./data/marketing";

export const MarketingHome: React.FC = () => (
  <>
    <section className="section-pad overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
        <div className="animate-fade-up">
          <p className="section-label">Multi-portal school management</p>
          <h1 className="heading-xl mt-4">
            The Operating System for Modern Academy Management
          </h1>
          <p className="body-lg mt-6 max-w-xl">
            One platform for administrators, parents, and students — with absolute tenant isolation,
            flawless auditing, and every operational module your institution needs.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link to="/contact" className="btn-marketing-primary">
              Request Live Demo <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#product-video" className="btn-marketing-secondary">
              <Play className="h-4 w-4" /> Watch 2-Min Video
            </a>
          </div>
        </div>
        <DashboardMockup className="pb-16 lg:pb-0" />
      </div>
    </section>

    <section className="border-y border-marketing-navy/10 bg-white/50 py-10">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.25em] text-marketing-navy/50">
          Trusted by forward-thinking institutions
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {SOCIAL_PROOF.map((name) => (
            <span
              key={name}
              className="font-display text-lg font-medium text-marketing-navy/35 grayscale"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>

    <section className="section-pad bg-marketing-cream-dark/40">
      <div className="mx-auto max-w-7xl">
        <div className="text-center">
          <p className="section-label">Architectural excellence</p>
          <h2 className="heading-lg mt-3">Built on three unshakeable pillars</h2>
        </div>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {PILLARS.map((p) => (
            <article key={p.title} className="glass-card p-8 transition-shadow hover:shadow-marketing-lg">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-marketing-burgundy/10 text-marketing-burgundy">
                <p.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-6 font-display text-xl font-semibold text-marketing-navy">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-marketing-navy/70">{p.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-14 text-center">
          <Link to="/features" className="btn-marketing-primary">
            Explore all modules <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>

    <section id="product-video" className="section-pad">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="heading-lg">See SchoolOS in motion</h2>
        <p className="mt-4 text-marketing-navy/70">
          A concise walkthrough of dashboards, report generation, and parent portals.
        </p>
        <div className="glass-card mt-10 aspect-video flex items-center justify-center bg-marketing-navy/5">
          <p className="text-sm text-marketing-navy/50">Product video placeholder — embed your Loom or Vimeo URL here</p>
        </div>
      </div>
    </section>
  </>
);
