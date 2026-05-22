import React from "react";
import { Link } from "react-router-dom";
import { Mail, MapPin, Phone, MessageCircle } from "lucide-react";
import { OrgBrandMark } from "./OrgBrandMark";
import {
  PUBLIC_CONTACT,
  FOOTER_QUICK_LINKS,
  FOOTER_PRODUCTS,
  FOOTER_SOCIAL,
} from "../data/site-config";

function FooterList({ items }: { items: readonly { to: string; label: string }[] }) {
  return (
    <ul className="mt-5 space-y-2.5">
      {items.map((item) => (
        <li key={item.to + item.label}>
          <Link to={item.to} className="mkt-footer-link group flex items-start gap-2.5 text-sm">
            <span className="mkt-footer-bullet mt-1.5 shrink-0" aria-hidden />
            <span className="group-hover:translate-x-0.5 transition-transform">{item.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export const PublicFooter: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="mkt-footer">
      <div className="mkt-footer-bg" aria-hidden />
      <div className="relative mx-auto max-w-7xl section-pad !pb-8 !pt-14 lg:!pt-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-4">
            <OrgBrandMark variant="footer" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/75">
              Masomo Best (SchoolOS) helps schools across Uganda and beyond run admissions, fees, exams,
              parent portals, and day-to-day operations on one secure, multi-tenant platform.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {FOOTER_SOCIAL.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mkt-footer-social"
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </a>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="lg:col-span-2 lg:col-start-6">
            <h3 className="mkt-footer-heading">Quick links</h3>
            <FooterList items={FOOTER_QUICK_LINKS} />
          </div>

          {/* Products */}
          <div className="lg:col-span-2">
            <h3 className="mkt-footer-heading">Products</h3>
            <FooterList items={FOOTER_PRODUCTS} />
          </div>

          {/* Contact */}
          <div className="lg:col-span-3">
            <h3 className="mkt-footer-heading">Contact us</h3>
            <ul className="mt-5 space-y-4 text-sm text-white/80">
              <li>
                <a href={`tel:${PUBLIC_CONTACT.phone.replace(/\s/g, "")}`} className="mkt-footer-contact flex gap-3">
                  <span className="mkt-footer-icon-wrap">
                    <Phone className="h-4 w-4" />
                  </span>
                  <span>{PUBLIC_CONTACT.phone}</span>
                </a>
              </li>
              <li>
                <a
                  href={`https://wa.me/${PUBLIC_CONTACT.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mkt-footer-contact flex gap-3"
                >
                  <span className="mkt-footer-icon-wrap">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <span>WhatsApp: {PUBLIC_CONTACT.whatsapp}</span>
                </a>
              </li>
              <li>
                <a href={`mailto:${PUBLIC_CONTACT.email}`} className="mkt-footer-contact flex gap-3">
                  <span className="mkt-footer-icon-wrap">
                    <Mail className="h-4 w-4" />
                  </span>
                  <span>{PUBLIC_CONTACT.email}</span>
                </a>
              </li>
              <li className="flex gap-3">
                <span className="mkt-footer-icon-wrap shrink-0">
                  <MapPin className="h-4 w-4" />
                </span>
                <span className="leading-relaxed">{PUBLIC_CONTACT.address}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mkt-footer-bottom mt-12 flex flex-col gap-4 border-t border-white/15 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/50">
            © {year} Masomo Best · SchoolOS. All rights reserved.{" "}
            <Link to="/contact" className="underline hover:text-white/80">
              Privacy & terms
            </Link>
          </p>
          <p className="text-xs text-white/40">Built for multi-tenant schools · masomobest.com</p>
        </div>
      </div>
    </footer>
  );
};
