import React from "react";

type Props = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
};

export const PageHero: React.FC<Props> = ({ eyebrow, title, subtitle, centered = true }) => (
  <section className="section-pad-tight border-b border-marketing-navy/[0.06] bg-white/40">
    <div className={`mx-auto max-w-4xl ${centered ? "text-center" : ""}`}>
      <span className="mkt-eyebrow">{eyebrow}</span>
      <h1 className="mkt-heading-xl mt-6">{title}</h1>
      {subtitle && <p className="mkt-body mx-auto mt-5 max-w-2xl">{subtitle}</p>}
    </div>
  </section>
);
