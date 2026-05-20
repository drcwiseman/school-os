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
      <div className="mx-auto max-w-6xl px-4 pb-3 pt-4 lg:px-6 relative">
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
            <NavLink to="/integrations" className={linkClass} onClick={closeAll}>Integrations</NavLink>
            <NavLink to="/about" className={linkClass} onClick={closeAll}>About</NavLink>
            <NavLink to="/contact" className={linkClass} onClick={closeAll}>Contact</NavLink>
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link to="/s/school-a/portal/login" className="btn-mkt-ghost text-sm" onClick={closeAll}>
              Parent / Student
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

        {/* Compact mega menu — absolute positioned directly relative to header container */}
        {featuresOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-45 cursor-default bg-marketing-navy/10 backdrop-blur-[2px]"
              aria-label="Close menu"
              onClick={() => setFeaturesOpen(false)}
            />
            <div className="absolute inset-x-4 top-full z-50 mt-2 flex justify-center pointer-events-none">
              <div className="mkt-mega-dropdown animate-mega-in pointer-events-auto w-full max-w-4xl p-5 sm:p-6 bg-white/95 backdrop-blur-md border border-marketing-navy/10 rounded-2xl shadow-2xl">
                <div className="grid gap-3 sm:grid-cols-3">
                  {MEGA_MENU.map((item) => (
                    <Link
                      key={item.title}
                      to={item.href}
                      className="mkt-mega-card group flex flex-col gap-3 rounded-xl p-4"
                      onClick={closeAll}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-marketing-accent/10 text-marketing-accent transition-all duration-300 group-hover:bg-marketing-accent group-hover:text-white">
                        <item.icon className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-heading text-sm font-semibold leading-snug text-marketing-navy">{item.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-marketing-navy/55">{item.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="mt-4 border-t border-marketing-navy/5 pt-4 text-center">
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
      </div>

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
