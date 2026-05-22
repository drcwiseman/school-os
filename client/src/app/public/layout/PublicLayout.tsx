import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { PromoStrip } from "../components/PromoStrip";
import { PublicHeader } from "../components/PublicHeader";
import { PublicFooter } from "../components/PublicFooter";
import { SeoHead, seoFromMarketing } from "../components/SeoHead";
import { AnalyticsScripts } from "../components/AnalyticsScripts";
import { PublicSiteProvider } from "../context/PublicSiteContext";
import type { PublicMarketingConfig } from "../context/PublicSiteContext";
import { api } from "../../api/client";

export const PublicLayout: React.FC = () => {
  const [marketing, setMarketing] = useState<PublicMarketingConfig | null>(null);

  useEffect(() => {
    document.body.classList.add("marketing-active");
    api.get("/api/public/site-config")
      .then((r) => setMarketing(r.data?.marketing ?? null))
      .catch(() => {});
    return () => document.body.classList.remove("marketing-active");
  }, []);

  return (
    <PublicSiteProvider value={marketing}>
    <div className="marketing-page flex min-h-screen flex-col">
      <SeoHead {...seoFromMarketing(marketing)} />
      <AnalyticsScripts
        config={{
          gaMeasurementId: marketing?.gaMeasurementId,
          gtmContainerId: marketing?.gtmContainerId,
          plausibleDomain: marketing?.plausibleDomain,
        }}
      />
      <PromoStrip />
      <PublicHeader />
      <main className="relative z-10 flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
    </PublicSiteProvider>
  );
};
