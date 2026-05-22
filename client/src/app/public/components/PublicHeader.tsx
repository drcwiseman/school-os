import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ChevronDown, Mail, Menu, Phone, Smartphone, X } from "lucide-react";
import { MEGA_MENU } from "../data/marketing";
import { PUBLIC_CONTACT, PUBLIC_NAV, FOOTER_SOCIAL } from "../data/site-config";
import { OrgBrandMark } from "./OrgBrandMark";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `mkt-nav-item ${isActive ? "mkt-nav-item-active" : ""}`;

export const PublicHeader: React.FC = () => {
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeAll = () => {
    setFeaturesOpen(false);
    setMobileOpen(false);
  };

  const mainNav = PUBLIC_NAV;

  return (
    <header className="mkt-header-shell sticky top-0 z-50">
      {/* Top contact bar */}
      <div className="mkt-topbar hidden sm:block">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-6 px-4 py-2 lg:px-8">
          <a href={`mailto:${PUBLIC_CONTACT.email}`} className="mkt-topbar-link flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{PUBLIC_CONTACT.email}</span>
          </a>
          <a href={`tel:${PUBLIC_CONTACT.phone.replace(/\s/g, "")}`} className="mkt-topbar-link flex items-center gap-2">
            <Smartphone className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{PUBLIC_CONTACT.phone}</span>
          </a>
          <div className="flex items-center gap-2 border-l border-white/25 pl-4">
            {FOOTER_SOCIAL.slice(0, 3).map(({ href, label, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="mkt-topbar-social"
                aria-label={label}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <div className="mkt-main-nav border-b border-slate-200/80 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 lg:px-8 lg:py-3.5">
          <OrgBrandMark onNavigate={closeAll} />

          <nav className="hidden items-center gap-0.5 xl:flex xl:gap-1">
            <NavLink to="/" end className={navLinkClass} onClick={closeAll}>
              Home
            </NavLink>
            <NavLink to="/about" className={navLinkClass} onClick={closeAll}>
              About
            </NavLink>
            <div className="relative">
              <button
                type="button"
                className={`mkt-nav-item inline-flex items-center gap-1 ${featuresOpen ? "mkt-nav-item-active" : ""}`}
                onClick={() => setFeaturesOpen((o) => !o)}
                aria-expanded={featuresOpen}
              >
                Features
                <ChevronDown className={`h-4 w-4 transition-transform ${featuresOpen ? "rotate-180" : ""}`} />
              </button>
            </div>
            {mainNav.map((item) =>
                "emphasis" in item && item.emphasis ? (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    className={({ isActive }) =>
                      `mkt-nav-item mkt-nav-item-emphasis ${isActive ? "mkt-nav-item-active" : ""}`
                    }
                    onClick={closeAll}
                  >
                    {item.label}
                  </NavLink>
                ) : (
                  <NavLink key={item.label} to={item.to} className={navLinkClass} onClick={closeAll}>
                    {item.label}
                  </NavLink>
                ),
              )}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              to="/s/school-a/portal/login"
              className="text-sm font-medium text-sky-700 hover:text-sky-900 transition-colors"
              onClick={closeAll}
            >
              Parent login
            </Link>
            <Link to="/contact" className="mkt-cta-buy" onClick={closeAll}>
              Request demo
            </Link>
          </div>

          <button
            type="button"
            className="rounded-lg border border-slate-200 p-2 text-marketing-navy xl:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {featuresOpen && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 cursor-default bg-marketing-navy/20"
              aria-label="Close features menu"
              onClick={() => setFeaturesOpen(false)}
            />
            <div className="absolute inset-x-0 top-full z-50 border-b border-slate-200 bg-white shadow-xl">
              <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
                <div className="grid gap-4 sm:grid-cols-3">
                  {MEGA_MENU.map((item) => (
                    <Link
                      key={item.title}
                      to={item.href}
                      className="mkt-mega-card group flex gap-4 rounded-xl border border-slate-100 p-4 hover:border-sky-200 hover:shadow-md transition-all"
                      onClick={closeAll}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                        <item.icon className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-heading text-sm font-semibold text-marketing-navy">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-500 leading-relaxed">{item.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                <p className="mt-4 text-center">
                  <Link to="/features" className="text-sm font-semibold text-sky-600 hover:text-sky-800" onClick={closeAll}>
                    View all capabilities →
                  </Link>
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-b border-slate-200 bg-white px-4 py-4 shadow-lg xl:hidden max-h-[70vh] overflow-y-auto">
          <div className="mb-4 flex flex-col gap-2 rounded-lg bg-sky-50 px-3 py-3 text-sm sm:hidden">
            <a href={`mailto:${PUBLIC_CONTACT.email}`} className="flex items-center gap-2 text-sky-900">
              <Mail className="h-4 w-4" /> {PUBLIC_CONTACT.email}
            </a>
            <a href={`tel:${PUBLIC_CONTACT.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 text-sky-900">
              <Phone className="h-4 w-4" /> {PUBLIC_CONTACT.phone}
            </a>
          </div>
          <div className="flex flex-col gap-0.5">
            {[
              ["/", "Home"],
              ["/about", "About"],
              ["/features", "Features"],
              ["/pricing", "Pricing"],
              ["/integrations", "Integrations"],
              ["/contact", "Contact / Demo"],
              ["/s/school-a/portal/login", "Parent portal"],
            ].map(([to, label]) => (
              <Link
                key={to + label}
                to={to}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-800"
                onClick={closeAll}
              >
                {label}
              </Link>
            ))}
            <Link to="/contact" className="mkt-cta-buy mt-3 text-center" onClick={closeAll}>
              Request demo
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
};
