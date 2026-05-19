import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { NO_HIDDEN_FEES, PRICING_TIERS } from "./data/marketing";

export const Pricing: React.FC = () => {
  const [annual, setAnnual] = useState(true);

  return (
    <>
      <section className="section-pad text-center">
        <div className="mx-auto max-w-3xl">
          <p className="section-label">Transparent SaaS pricing</p>
          <h1 className="heading-xl mt-3">Plans that scale with your institution</h1>
          <p className="body-lg mt-6">
            From single-campus academies to district consortiums — no surprise per-seat traps on parent accounts.
          </p>
          <div className="mt-10 inline-flex items-center gap-3 rounded-full border border-marketing-navy/15 bg-white p-1 shadow-marketing">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${!annual ? "bg-marketing-navy text-marketing-cream" : "text-marketing-navy/70"}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${annual ? "bg-marketing-navy text-marketing-cream" : "text-marketing-navy/70"}`}
            >
              Annual <span className="ml-1 text-marketing-sage">(save 20%)</span>
            </button>
          </div>
        </div>
      </section>

      <section className="pb-20 px-6 md:px-10">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-3">
          {PRICING_TIERS.map((tier) => {
            const price = annual ? tier.annual : tier.monthly;
            const isCustom = price === null;
            return (
              <article
                key={tier.name}
                className={`glass-card flex flex-col p-8 ${tier.highlight ? "pricing-popular" : ""}`}
              >
                {tier.highlight && (
                  <span className="mb-4 inline-block w-fit rounded-full bg-marketing-burgundy px-3 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                )}
                <h2 className="font-display text-2xl font-semibold text-marketing-navy">{tier.name}</h2>
                <p className="mt-2 text-sm text-marketing-navy/60">{tier.audience}</p>
                <div className="mt-8">
                  {isCustom ? (
                    <p className="font-display text-3xl font-semibold text-marketing-navy">Custom</p>
                  ) : (
                    <>
                      <p className="font-display text-4xl font-semibold text-marketing-navy">
                        ${price}
                        <span className="text-base font-normal text-marketing-navy/50">
                          /{annual ? "yr" : "mo"}
                        </span>
                      </p>
                      {annual && tier.monthly && (
                        <p className="mt-1 text-xs text-marketing-sage">
                          vs ${tier.monthly * 12}/yr monthly — you save 20%
                        </p>
                      )}
                    </>
                  )}
                </div>
                <ul className="mt-8 flex-1 space-y-3 border-t border-marketing-navy/10 pt-8">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-marketing-navy/80">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-marketing-sage" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/contact"
                  className={`mt-8 text-center ${tier.highlight ? "btn-marketing-primary" : "btn-marketing-secondary"} w-full`}
                >
                  {isCustom ? "Contact sales" : "Start conversation"}
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section-pad bg-marketing-cream-dark/50">
        <div className="mx-auto max-w-7xl">
          <h2 className="heading-lg text-center">No hidden fees</h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm text-marketing-navy/70">
            Everything below is included — we believe clarity builds trust with school boards.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {NO_HIDDEN_FEES.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl bg-white/80 p-4 shadow-marketing">
                <Check className="h-5 w-5 shrink-0 text-marketing-sage" />
                <span className="text-sm text-marketing-navy/85">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};
