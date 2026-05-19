import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Database, Lock, Zap } from "lucide-react";
import { PageHero } from "./components/PageHero";

const INTEGRITY = [
  {
    icon: Lock,
    title: "Data safeguards",
    body: "Every record is scoped by tenant_id at the database layer. Schools never share rows — isolation is architectural, not a UI filter.",
  },
  {
    icon: Database,
    title: "Immutable audit trails",
    body: "Structural changes capture actor identity, timestamps, and state transitions — giving boards and regulators a defensible paper trail.",
  },
  {
    icon: Zap,
    title: "Performance commitments",
    body: "Built on a lean TypeScript stack with instant SPA navigation, background job queues for PDFs and campaigns, and zero legacy bloat.",
  },
] as const;

export const About: React.FC = () => (
  <>
    <PageHero
      eyebrow="Our mission"
      title="Why we built SchoolOS"
      subtitle="Legacy school tools fail modern institutions. We built the platform principals actually want to show their boards."
    />

    <section className="section-pad">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6 mkt-body">
          <p>
            Legacy school management tools were never designed for today&apos;s expectations: parents expect instant portals,
            finance teams need bulletproof invoicing, and regulators demand audit trails that hold up under scrutiny.
          </p>
          <p>
            Most incumbent systems ship cluttered interfaces, leaky multi-school data models, and PDF pipelines that choke
            under end-of-term load.
          </p>
          <p>
            SchoolOS is a modern multi-tenant platform — one codebase, strict isolation per school, and fifteen integrated
            operational phases from admissions through payroll and district-scale governance.
          </p>
        </div>
        <div className="glass-card-elevated p-10">
          <p className="font-display text-3xl font-semibold leading-snug text-marketing-navy">
            &ldquo;Software your board can trust — and your staff will actually use.&rdquo;
          </p>
          <p className="mt-4 text-sm text-marketing-navy/50">— SchoolOS design principle</p>
        </div>
      </div>
    </section>

    <section className="section-pad bg-marketing-navy text-marketing-cream">
      <div className="mx-auto max-w-7xl">
        <h2 className="mkt-heading-lg text-center text-marketing-cream">System integrity you can explain to a board</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-marketing-cream/65">
          Technical depth without jargon — what matters to principals, IT directors, and compliance officers.
        </p>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {INTEGRITY.map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
              <item.icon className="h-8 w-8 text-marketing-sage" strokeWidth={1.5} />
              <h3 className="mt-6 font-display text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-marketing-cream/70">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="section-pad text-center">
      <h2 className="mkt-heading-lg">Ready to modernize your campus?</h2>
      <p className="mkt-body mt-4">We partner with institutions from 200 to 20,000 students.</p>
      <Link to="/contact" className="btn-mkt-primary mt-8 inline-flex">
        Speak with our team <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  </>
);
