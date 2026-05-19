import React from "react";
import { Reveal } from "./Reveal";

type Props = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  centered?: boolean;
};

export const PageHero: React.FC<Props> = ({ eyebrow, title, subtitle, centered = true }) => (
  <section className="section-pad-tight border-b border-marketing-navy/5 bg-white/50">
    <Reveal className={`mx-auto max-w-4xl ${centered ? "text-center" : ""}`}>
      <p className="mkt-eyebrow mkt-eyebrow-blue">{eyebrow}</p>
      <h1 className="mkt-heading-xl mt-5">{title}</h1>
      {subtitle && <p className="mkt-body mx-auto mt-5 max-w-2xl">{subtitle}</p>}
    </Reveal>
  </section>
);
