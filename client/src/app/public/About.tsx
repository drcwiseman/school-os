import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Database, Lock, Zap } from "lucide-react";

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
    <section className="section-pad">
      <div className="mx-auto max-w-3xl">
        <p className="section-label">Our mission</p>
        <h1 className="heading-xl mt-3">Why we built SchoolOS</h1>
        <div className="mt-10 space-y-6 text-lg leading-relaxed text-marketing-navy/80">
          <p>
            Legacy school management tools were never designed for today&apos;s expectations: parents expect instant portals,
            finance teams need bulletproof invoicing, and regulators demand audit trails that actually hold up under scrutiny.
          </p>
          <p>
            Most incumbent systems ship cluttered interfaces, leaky multi-school data models, and PDF pipelines that choke
            under end-of-term load. School leaders deserve software that feels as considered as the institutions they run.
          </p>
          <p>
            SchoolOS is a modern multi-tenant platform — one codebase, strict isolation per school, and fifteen integrated
            operational phases from admissions through payroll, messaging, and district-scale governance.
          </p>
        </div>
      </div>
    </section>

    <section className="section-pad bg-marketing-navy text-marketing-cream">
      <div className="mx-auto max-w-7xl">
        <h2 className="heading-lg text-center">System integrity you can explain to a board</h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-marketing-cream/70">
          Technical depth without the jargon — what matters to principals, IT directors, and compliance officers.
        </p>
        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {INTEGRITY.map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
              <item.icon className="h-8 w-8 text-marketing-sage" />
              <h3 className="mt-6 font-display text-xl font-semibold">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-marketing-cream/75">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="section-pad text-center">
      <h2 className="heading-lg">Ready to modernize your campus operations?</h2>
      <p className="mt-4 text-marketing-navy/70">We partner with institutions from 200 to 20,000 students.</p>
      <Link to="/contact" className="btn-marketing-primary mt-8 inline-flex">
        Speak with our team <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  </>
);
