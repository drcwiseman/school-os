import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Play } from "lucide-react";
import { HeroVisual } from "./components/HeroVisual";
import { Reveal } from "./components/Reveal";
import { PILLARS, SOCIAL_PROOF } from "./data/marketing";

const HERO_CHECKS = [
  "Multi-tenant data isolation",
  "Parent & student portals",
  "Finance, HR & academics unified",
] as const;

export const MarketingHome: React.FC = () => (
  <>
    <section className="mkt-hero">
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <p className="mkt-eyebrow mkt-eyebrow-blue">Schools solution</p>
          <h1 className="mkt-heading-xl mt-5">
            The operating system for{" "}
            <span className="mkt-gradient-text">modern academy</span> management
          </h1>
          <p className="mkt-body mt-6 max-w-lg">
            One elegant platform for administrators, parents, and students — tenant isolation,
            audit-ready operations, and every module your institution needs in one place.
          </p>
          <ul className="mt-8 space-y-2.5">
            {HERO_CHECKS.map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm font-medium text-marketing-navy/70">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-marketing-accent/15">
                  <Check className="h-3 w-3 text-marketing-accent" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link to="/contact" className="btn-mkt-primary group">
              Request Live Demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="#product-video" className="btn-mkt-secondary group">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-marketing-navy/5 transition-colors group-hover:bg-marketing-accent/10">
                <Play className="h-4 w-4 text-marketing-accent" />
              </span>
              Watch 2-Min Overview
            </a>
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
              className="font-heading text-lg font-semibold text-marketing-navy/25 transition-colors hover:text-marketing-navy/40"
            >
              {name}
            </span>
          ))}
        </div>
      </Reveal>
    </section>

    <section className="section-pad">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="mkt-eyebrow mkt-eyebrow-blue">Architectural excellence</p>
          <h2 className="mkt-heading-lg mt-5">Built on three unshakeable pillars</h2>
          <p className="mkt-body mt-4">
            Enterprise foundations for boards, regulators, and IT directors who demand proof — not promises.
          </p>
        </Reveal>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delayMs={i * 80}>
              <article className="mkt-pillar-card h-full">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-marketing-accent/15 to-marketing-sage/10 text-marketing-accent">
                  <p.icon className="h-7 w-7" strokeWidth={1.5} />
                </div>
                <h3 className="mt-6 font-heading text-xl font-bold text-marketing-navy">{p.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-marketing-navy/60">{p.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-14 text-center" delayMs={200}>
          <Link to="/features" className="btn-mkt-primary group">
            Explore all modules
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </div>
    </section>

    <section id="product-video" className="section-pad bg-gradient-to-b from-marketing-cream to-white">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="mkt-eyebrow mkt-eyebrow-blue">Product tour</p>
        <h2 className="mkt-heading-lg mt-5">See SchoolOS in motion</h2>
        <p className="mkt-body mt-4">
          A concise walkthrough of dashboards, report generation, and parent portals.
        </p>
        <div className="mkt-video-card group mt-10">
          <div className="flex aspect-video items-center justify-center">
            <button
              type="button"
              className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-marketing-lg ring-4 ring-marketing-accent/20 transition-transform duration-300 group-hover:scale-105"
              aria-label="Play video"
            >
              <Play className="ml-1 h-8 w-8 text-marketing-accent" fill="currentColor" />
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
