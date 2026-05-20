import React from "react";
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { usePublicSite } from "../context/PublicSiteContext";

type Props = {
  variant?: "header" | "footer";
  onNavigate?: () => void;
};

export const OrgBrandMark: React.FC<Props> = ({ variant = "header", onNavigate }) => {
  const site = usePublicSite();
  const name = site?.siteName?.trim() || "SchoolOS";
  const logoUrl = site?.orgLogoUrl?.trim();
  const logoAlt = site?.orgLogoAlt?.trim() || `${name} logo`;

  const iconBox =
    variant === "footer" ? (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-marketing-accent/20 overflow-hidden">
        {logoUrl ? (
          <img src={logoUrl} alt={logoAlt} width={40} height={40} className="h-full w-full object-contain" />
        ) : (
          <GraduationCap className="h-5 w-5 text-marketing-accent" aria-hidden />
        )}
      </div>
    ) : (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-marketing-accent to-marketing-navy text-white shadow-md overflow-hidden shrink-0">
        {logoUrl ? (
          <img src={logoUrl} alt={logoAlt} width={36} height={36} className="h-full w-full object-contain bg-white/10" />
        ) : (
          <GraduationCap className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        )}
      </div>
    );

  const nameClass =
    variant === "footer"
      ? "font-heading text-xl font-bold text-white"
      : "font-heading text-lg font-bold tracking-tight text-marketing-navy";

  return (
    <Link to="/" className="inline-flex items-center gap-2.5 shrink-0" onClick={onNavigate}>
      {iconBox}
      <span className={nameClass}>{name}</span>
    </Link>
  );
};
