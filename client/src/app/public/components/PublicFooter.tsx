import React from "react";
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";

export const PublicFooter: React.FC = () => (
  <footer className="border-t border-marketing-navy/10 bg-marketing-navy text-marketing-cream">
    <div className="mx-auto max-w-7xl section-pad !py-14">
      <div className="grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-marketing-sage/20">
              <GraduationCap className="h-5 w-5 text-marketing-sage" />
            </div>
            <span className="font-display text-xl font-semibold">SchoolOS</span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-marketing-cream/70">
            The operating system for modern academy management — multi-tenant, audit-ready, and built for institutions that cannot compromise on data integrity.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-marketing-sage">Product</p>
          <ul className="mt-4 space-y-2 text-sm text-marketing-cream/80">
            <li><Link to="/features" className="hover:text-white">Features</Link></li>
            <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
            <li><Link to="/contact" className="hover:text-white">Request demo</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-marketing-sage">Sign in</p>
          <ul className="mt-4 space-y-2 text-sm text-marketing-cream/80">
            <li><Link to="/s/school-a/login" className="hover:text-white">Staff portal</Link></li>
            <li><Link to="/s/school-a/portal/login" className="hover:text-white">Parent / student</Link></li>
            <li><Link to="/platform/login" className="hover:text-white">Platform console</Link></li>
          </ul>
        </div>
      </div>
      <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-8 text-xs text-marketing-cream/50 md:flex-row md:justify-between">
        <p>© {new Date().getFullYear()} SchoolOS. All rights reserved.</p>
        <p>Built for multi-tenant academic institutions worldwide.</p>
      </div>
    </div>
  </footer>
);
