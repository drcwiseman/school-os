import React from "react";
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

export const PublicFooter: React.FC = () => (
  <footer className="mkt-footer">
    <div className="mx-auto max-w-6xl section-pad !pb-10 !pt-14">
      <div className="grid gap-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <Link to="/" className="inline-flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-marketing-accent/20">
              <GraduationCap className="h-5 w-5 text-marketing-accent" />
            </div>
            <span className="font-heading text-xl font-bold text-white">SchoolOS</span>
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/55">
            The operating system for modern academy management — multi-tenant, audit-ready, and
            built for institutions that cannot compromise on data integrity.
          </p>
        </div>
        <div className="md:col-span-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-marketing-accent/80">Product</p>
          <ul className="mt-5 space-y-3 text-sm text-white/60">
            <li><Link to="/features" className="transition-colors hover:text-white">Features</Link></li>
            <li><Link to="/pricing" className="transition-colors hover:text-white">Pricing</Link></li>
            <li><Link to="/contact" className="transition-colors hover:text-white">Request demo</Link></li>
          </ul>
        </div>
        <div className="md:col-span-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-marketing-accent/80">Sign in</p>
          <ul className="mt-5 space-y-3 text-sm text-white/60">
            <li><Link to="/s/school-a/login" className="transition-colors hover:text-white">Staff portal</Link></li>
            <li><Link to="/s/school-a/portal/login" className="transition-colors hover:text-white">Parent / student</Link></li>
            <li><Link to="/platform/login" className="transition-colors hover:text-white">Platform console</Link></li>
          </ul>
        </div>
      </div>
      <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-8 text-xs text-white/35 md:flex-row md:items-center md:justify-between">
        <p>© {new Date().getFullYear()} SchoolOS. All rights reserved.</p>
        <p>Built for multi-tenant academic institutions worldwide.</p>
      </div>
    </div>
  </footer>
);
