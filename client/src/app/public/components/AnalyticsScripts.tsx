import React, { useEffect } from "react";

type MarketingConfig = {
  gaMeasurementId?: string;
  gtmContainerId?: string;
  plausibleDomain?: string;
};

export const AnalyticsScripts: React.FC<{ config?: MarketingConfig | null }> = ({ config }) => {
  useEffect(() => {
    if (!config) return;

    if (config.gaMeasurementId && !document.getElementById("ga4-schoolos")) {
      const s = document.createElement("script");
      s.id = "ga4-schoolos";
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${config.gaMeasurementId}`;
      document.head.appendChild(s);
      const inline = document.createElement("script");
      inline.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${config.gaMeasurementId}');`;
      document.head.appendChild(inline);
    }

    if (config.plausibleDomain && !document.getElementById("plausible-schoolos")) {
      const s = document.createElement("script");
      s.id = "plausible-schoolos";
      s.defer = true;
      s.dataset.domain = config.plausibleDomain;
      s.src = "https://plausible.io/js/script.js";
      document.head.appendChild(s);
    }
  }, [config?.gaMeasurementId, config?.plausibleDomain]);

  if (!config?.gtmContainerId) return null;
  return (
    <noscript>
      <iframe
        title="gtm"
        src={`https://www.googletagmanager.com/ns.html?id=${config.gtmContainerId}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
};
