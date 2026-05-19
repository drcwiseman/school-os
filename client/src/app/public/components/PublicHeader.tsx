import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ChevronDown, GraduationCap, Menu, X } from "lucide-react";
import { MEGA_MENU } from "../data/marketing";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "mkt-nav-link mkt-nav-link-active" : "mkt-nav-link";

export const PublicHeader: React.FC = () => {
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="glass-nav">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-3.5 md:px-10 md:py-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-marketing-navy shadow-marketing">
            <GraduationCap className="h-5 w-5 text-marketing-cream" strokeWidth={1.75} />
          </div>
          <span className="font-display text-[1.35rem] font-semibold tracking-tight text-marketing-navy">
            SchoolOS
          </span>
        </Link>

        <nav className="hidden items-center gap-9 lg:flex">
          <div
            className="relative"
            onMouseEnter={() => setFeaturesOpen(true)}
            onMouseLeave={() => setFeaturesOpen(false)}
          >
            <button
              type="button"
              className="mkt-nav-link flex items-center gap-1"
              aria-expanded={featuresOpen}
            >
              Features
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${featuresOpen ? "rotate-180" : ""}`} />
            </button>
            {featuresOpen && (
              <div className="mega-menu-panel animate-fade-in">
                <div className="mx-auto grid max-w-7xl gap-2 px-6 py-6 md:grid-cols-3 md:px-10">
                  {MEGA_MENU.map((item) => (
                    <Link
                      key={item.title}
                      to={item.href}
                      className="group flex gap-4 rounded-2xl p-5 transition-all hover:bg-marketing-cream"
                      onClick={() => setFeaturesOpen(false)}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-marketing-sage/12 text-marketing-sage transition-colors group-hover:bg-marketing-sage group-hover:text-white">
                        <item.icon className="h-6 w-6" strokeWidth={1.5} />
                      </div>
                      <div>
                        <p className="font-semibold text-marketing-navy">{item.title}</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-marketing-navy/60">{item.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="border-t border-marketing-navy/8 bg-marketing-cream/50 px-6 py-3 text-center">
                  <Link to="/features" className="text-sm font-semibold text-marketing-burgundy hover:underline">
                    View all capabilities →
                  </Link>
                </div>
              </div>
            )}
          </div>
          <NavLink to="/pricing" className={linkClass}>Pricing</NavLink>
          <NavLink to="/about" className={linkClass}>About</NavLink>
          <NavLink to="/contact" className={linkClass}>Contact</NavLink>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link to="/s/school-a/portal/login" className="btn-mkt-ghost">
            Parent Login
          </Link>
          <Link to="/contact" className="btn-mkt-primary">
            Request Demo
          </Link>
        </div>

        <button
          type="button"
          className="rounded-xl p-2.5 text-marketing-navy hover:bg-marketing-navy/5 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <nav className="border-t border-marketing-navy/8 bg-white/95 px-5 py-5 lg:hidden">
          <div className="flex flex-col gap-1">
            {[
              ["/features", "Features"],
              ["/pricing", "Pricing"],
              ["/about", "About"],
              ["/contact", "Contact"],
              ["/s/school-a/portal/login", "Parent Login"],
            ].map(([to, label]) => (
              <Link key={to} to={to} className="rounded-lg px-3 py-2.5 text-sm font-medium text-marketing-navy hover:bg-marketing-cream" onClick={() => setMobileOpen(false)}>
                {label}
              </Link>
            ))}
            <Link to="/contact" className="btn-mkt-primary mt-3 text-center" onClick={() => setMobileOpen(false)}>
              Request Demo
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
};
