import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ChevronDown, GraduationCap, Menu, X } from "lucide-react";
import { MEGA_MENU } from "../data/marketing";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition-colors ${isActive ? "text-marketing-burgundy" : "text-marketing-navy/80 hover:text-marketing-navy"}`;

export const PublicHeader: React.FC = () => {
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="glass-nav">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 md:px-10">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-marketing-navy text-marketing-cream">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-semibold text-marketing-navy">SchoolOS</span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          <div
            className="relative"
            onMouseEnter={() => setFeaturesOpen(true)}
            onMouseLeave={() => setFeaturesOpen(false)}
          >
            <button
              type="button"
              className="flex items-center gap-1 text-sm font-medium text-marketing-navy/80 hover:text-marketing-navy"
              aria-expanded={featuresOpen}
            >
              Features <ChevronDown className={`h-4 w-4 transition-transform ${featuresOpen ? "rotate-180" : ""}`} />
            </button>
            {featuresOpen && (
              <div className="mega-menu-panel animate-fade-in">
                <div className="mx-auto grid max-w-7xl gap-4 px-6 py-8 md:grid-cols-3 md:px-10">
                  {MEGA_MENU.map((item) => (
                    <Link
                      key={item.title}
                      to={item.href}
                      className="group flex gap-4 rounded-2xl p-4 transition-colors hover:bg-marketing-cream-dark/60"
                      onClick={() => setFeaturesOpen(false)}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-marketing-sage/15 text-marketing-sage group-hover:bg-marketing-sage group-hover:text-white">
                        <item.icon className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold text-marketing-navy">{item.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-marketing-navy/65">{item.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="border-t border-marketing-navy/10 px-6 py-3 text-center md:px-10">
                  <Link to="/features" className="text-sm font-medium text-marketing-burgundy hover:underline">
                    View all capabilities →
                  </Link>
                </div>
              </div>
            )}
          </div>
          <NavLink to="/pricing" className={navLinkClass}>Pricing</NavLink>
          <NavLink to="/about" className={navLinkClass}>About</NavLink>
          <NavLink to="/contact" className={navLinkClass}>Contact</NavLink>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link to="/s/school-a/portal/login" className="btn-marketing-ghost">
            Parent Login
          </Link>
          <Link to="/contact" className="btn-marketing-primary">
            Request Demo
          </Link>
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-marketing-navy lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen && (
        <nav className="border-t border-marketing-navy/10 px-6 py-4 lg:hidden">
          <div className="flex flex-col gap-3">
            <Link to="/features" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>Features</Link>
            <Link to="/pricing" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>Pricing</Link>
            <Link to="/about" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>About</Link>
            <Link to="/contact" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>Contact</Link>
            <Link to="/s/school-a/portal/login" className="text-sm font-medium" onClick={() => setMobileOpen(false)}>Parent Login</Link>
            <Link to="/contact" className="btn-marketing-primary mt-2 text-center" onClick={() => setMobileOpen(false)}>Request Demo</Link>
          </div>
        </nav>
      )}
    </header>
  );
};

