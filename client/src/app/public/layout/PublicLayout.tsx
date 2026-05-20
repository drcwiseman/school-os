import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { PublicHeader } from "../components/PublicHeader";
import { PublicFooter } from "../components/PublicFooter";
import { SeoHead } from "../components/SeoHead";
import { AnalyticsScripts } from "../components/AnalyticsScripts";
import { api } from "../../api/client";

export const PublicLayout: React.FC = () => {
  const [marketing, setMarketing] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    document.body.classList.add("marketing-active");
    api.get("/api/public/site-config")
      .then((r) => setMarketing(r.data?.marketing ?? null))
      .catch(() => {});
    return () => document.body.classList.remove("marketing-active");
  }, []);

  return (
    <div className="marketing-page flex min-h-screen flex-col">
      <SeoHead
        title={marketing?.defaultTitle}
        description={marketing?.defaultDescription}
        keywords={marketing?.defaultKeywords}
        canonical={marketing?.siteUrl}
        ogImage={marketing?.ogImage}
      />
      <AnalyticsScripts
        config={{
          gaMeasurementId: marketing?.gaMeasurementId,
          gtmContainerId: marketing?.gtmContainerId,
          plausibleDomain: marketing?.plausibleDomain,
        }}
      />
      <PublicHeader />
      <main className="relative z-10 flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
};
