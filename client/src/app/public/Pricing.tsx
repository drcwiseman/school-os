import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { PageHero } from "./components/PageHero";
import { NO_HIDDEN_FEES, PRICING_TIERS } from "./data/marketing";

export const Pricing: React.FC = () => {
  const [annual, setAnnual] = useState(true);

  return (
    <>
      <PageHero
        eyebrow="Transparent SaaS pricing"
        title="Plans that scale with your institution"
        subtitle="From single-campus academies to district consortiums — no surprise per-seat traps on parent accounts."
      />

      <section className="section-pad-tight -mt-4">
        <div className="mx-auto flex max-w-7xl flex-col items-center">
          <div className="inline-flex rounded-full border border-marketing-navy/10 bg-white p-1.5 shadow-marketing">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-all ${
                !annual ? "bg-marketing-navy text-marketing-cream shadow-sm" : "text-marketing-navy/60"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`rounded-full px-6 py-2.5 text-sm font-semibold transition-all ${
                annual ? "bg-marketing-navy text-marketing-cream shadow-sm" : "text-marketing-navy/60"
              }`}
            >
              Annual <span className="text-marketing-sage">· save 20%</span>
            </button>
          </div>
        </div>
      </section>

      <section className="section-pad !pt-4">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-3 lg:gap-6">
          {PRICING_TIERS.map((tier) => {
            const price = annual ? tier.annual : tier.monthly;
            const isCustom = price === null;
            return (
              <article
                key={tier.name}
                className={`flex flex-col rounded-2xl p-8 ${tier.highlight ? "pricing-popular" : "glass-card"}`}
              >
                {tier.highlight && (
                  <span className="mb-4 w-fit rounded-full bg-marketing-burgundy px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                    Most Popular
                  </span>
                )}
                <h2 className="font-display text-2xl font-semibold text-marketing-navy">{tier.name}</h2>
                <p className="mt-2 text-sm text-marketing-navy/55">{tier.audience}</p>
                <div className="mt-8 border-b border-marketing-navy/8 pb-8">
                  {isCustom ? (
                    <p className="font-display text-4xl font-semibold text-marketing-navy">Custom</p>
                  ) : (
                    <>
                      <p className="font-display text-5xl font-semibold text-marketing-navy">
                        ${price}
                        <span className="text-lg font-normal text-marketing-navy/45">/{annual ? "yr" : "mo"}</span>
                      </p>
                      {annual && tier.monthly && (
                        <p className="mt-2 text-xs font-medium text-marketing-sage">
                          Save 20% vs monthly billing
                        </p>
                      )}
                    </>
                  )}
                </div>
                <ul className="mt-8 flex-1 space-y-3.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-marketing-navy/75">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-marketing-sage" strokeWidth={2.5} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/contact"
                  className={`mt-10 w-full text-center ${tier.highlight ? "btn-mkt-primary" : "btn-mkt-secondary"}`}
                >
                  {isCustom ? "Contact sales" : "Start conversation"}
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section-pad bg-white/60">
        <div className="mx-auto max-w-7xl">
          <h2 className="mkt-heading-lg text-center">No hidden fees</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm text-marketing-navy/55">
            Everything below is included — clarity builds trust with school boards.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NO_HIDDEN_FEES.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-marketing-navy/8 bg-white p-5 shadow-sm">
                <Check className="h-5 w-5 shrink-0 text-marketing-sage" strokeWidth={2} />
                <span className="text-sm leading-snug text-marketing-navy/80">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
