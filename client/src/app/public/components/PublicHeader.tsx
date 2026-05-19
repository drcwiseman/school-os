import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ChevronDown, GraduationCap, Menu, X } from "lucide-react";
import { MEGA_MENU } from "../data/marketing";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `mkt-nav-link rounded-full px-3 py-1.5 ${isActive ? "mkt-nav-link-active" : ""}`;

export const PublicHeader: React.FC = () => {
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeAll = () => {
    setFeaturesOpen(false);
    setMobileOpen(false);
  };

  return (
    <header className="mkt-header sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 pb-3 pt-4 lg:px-6">
        <div className="mkt-nav-pill flex items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" onClick={closeAll}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-marketing-accent to-marketing-navy text-white shadow-md">
              <GraduationCap className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight text-marketing-navy">
              SchoolOS
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            <button
              type="button"
              className={`mkt-nav-link flex items-center gap-1 rounded-full px-3 py-1.5 ${featuresOpen ? "bg-marketing-accent/10 text-marketing-accent" : ""}`}
              onClick={() => setFeaturesOpen((o) => !o)}
              aria-expanded={featuresOpen}
            >
              Features
              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${featuresOpen ? "rotate-180" : ""}`} />
            </button>
            <NavLink to="/pricing" className={linkClass} onClick={closeAll}>Pricing</NavLink>
            <NavLink to="/about" className={linkClass} onClick={closeAll}>About</NavLink>
            <NavLink to="/contact" className={linkClass} onClick={closeAll}>Contact</NavLink>
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link to="/s/school-a/portal/login" className="btn-mkt-ghost text-sm" onClick={closeAll}>
              Parent Login
            </Link>
            <Link to="/contact" className="btn-mkt-primary text-sm" onClick={closeAll}>
              Request Demo
            </Link>
          </div>

          <button
            type="button"
            className="rounded-xl p-2 text-marketing-navy lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Full-width mega menu — fixed so it never clips to the Features button width */}
      {featuresOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 top-16 z-40 cursor-default bg-marketing-navy/10 backdrop-blur-[2px] lg:top-[4.75rem]"
            aria-label="Close menu"
            onClick={() => setFeaturesOpen(false)}
          />
          <div className="mkt-mega-dropdown animate-mega-in fixed left-0 right-0 z-50 lg:top-[4.75rem]">
            <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
              <div className="grid gap-4 md:grid-cols-3">
                {MEGA_MENU.map((item) => (
                  <Link
                    key={item.title}
                    to={item.href}
                    className="mkt-mega-card group flex gap-4 rounded-2xl p-5"
                    onClick={closeAll}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-marketing-accent/10 text-marketing-accent transition-all duration-300 group-hover:scale-110 group-hover:bg-marketing-accent group-hover:text-white group-hover:shadow-lg">
                      <item.icon className="h-6 w-6" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-heading text-base font-semibold text-marketing-navy">{item.title}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-marketing-navy/55">{item.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="mt-6 text-center">
                <Link
                  to="/features"
                  className="text-sm font-semibold text-marketing-accent transition-colors hover:text-marketing-navy"
                  onClick={closeAll}
                >
                  View all capabilities →
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {mobileOpen && (
        <nav className="border-t border-marketing-navy/8 bg-white px-5 py-4 shadow-lg lg:hidden">
          <div className="flex flex-col gap-1">
            {[
              ["/features", "Features"],
              ["/pricing", "Pricing"],
              ["/about", "About"],
              ["/contact", "Contact"],
              ["/s/school-a/portal/login", "Parent Login"],
            ].map(([to, label]) => (
              <Link
                key={to}
                to={to}
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-marketing-navy hover:bg-marketing-cream"
                onClick={closeAll}
              >
                {label}
              </Link>
            ))}
            <Link to="/contact" className="btn-mkt-primary mt-3 text-center" onClick={closeAll}>
              Request Demo
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
};
