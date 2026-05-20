import React, { createContext, useContext } from "react";

export type PublicMarketingConfig = {
  siteName?: string;
  siteUrl?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultKeywords?: string;
  orgLogoUrl?: string;
  orgLogoAlt?: string;
  ogImage?: string;
  ogImageAlt?: string;
  twitterHandle?: string;
  gaMeasurementId?: string;
  gtmContainerId?: string;
  plausibleDomain?: string;
};

const PublicSiteContext = createContext<PublicMarketingConfig | null>(null);

export function PublicSiteProvider({
  value,
  children,
}: {
  value: PublicMarketingConfig | null;
  children: React.ReactNode;
}) {
  return (
    <PublicSiteContext.Provider value={value}>
      {children}
    </PublicSiteContext.Provider>
  );
}

export function usePublicSite() {
  return useContext(PublicSiteContext);
}
