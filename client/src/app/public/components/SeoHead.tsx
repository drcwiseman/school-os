import React, { useEffect } from "react";
import type { PublicMarketingConfig } from "../context/PublicSiteContext";

export type SeoProps = {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  siteName?: string;
  ogImage?: string;
  ogImageAlt?: string;
  orgLogoUrl?: string;
  orgLogoAlt?: string;
  twitterHandle?: string;
};

function upsertMeta(name: string, content: string, attr: "name" | "property" = "name") {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertCanonical(href: string) {
  if (!href) return;
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

function upsertJsonLd(id: string, data: Record<string, unknown>) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export const SeoHead: React.FC<SeoProps> = ({
  title,
  description,
  keywords,
  canonical,
  siteName,
  ogImage,
  ogImageAlt,
  orgLogoUrl,
  orgLogoAlt,
  twitterHandle,
}) => {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      upsertMeta("description", description);
      upsertMeta("og:description", description, "property");
      upsertMeta("twitter:description", description);
    }
    if (keywords) upsertMeta("keywords", keywords);
    if (title) {
      upsertMeta("og:title", title, "property");
      upsertMeta("twitter:title", title);
    }
    if (siteName) upsertMeta("og:site_name", siteName, "property");
    upsertMeta("og:type", "website", "property");
    upsertMeta("twitter:card", ogImage ? "summary_large_image" : "summary");

    if (ogImage) {
      upsertMeta("og:image", ogImage, "property");
      upsertMeta("twitter:image", ogImage);
      if (ogImageAlt) {
        upsertMeta("og:image:alt", ogImageAlt, "property");
        upsertMeta("twitter:image:alt", ogImageAlt);
      }
    }

    if (twitterHandle) {
      const handle = twitterHandle.startsWith("@") ? twitterHandle : `@${twitterHandle}`;
      upsertMeta("twitter:site", handle);
    }

    if (canonical) {
      upsertCanonical(canonical);
      upsertMeta("og:url", canonical, "property");
    }

    if (siteName && (orgLogoUrl || canonical)) {
      const org: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: siteName,
        url: canonical || undefined,
      };
      if (orgLogoUrl) {
        org.logo = {
          "@type": "ImageObject",
          url: orgLogoUrl,
          ...(orgLogoAlt ? { caption: orgLogoAlt, name: orgLogoAlt } : {}),
        };
      }
      upsertJsonLd("schoolos-org-jsonld", org);
    }
  }, [title, description, keywords, canonical, siteName, ogImage, ogImageAlt, orgLogoUrl, orgLogoAlt, twitterHandle]);

  return null;
};

export function seoFromMarketing(m: PublicMarketingConfig | null): SeoProps {
  if (!m) return {};
  return {
    title: m.defaultTitle,
    description: m.defaultDescription,
    keywords: m.defaultKeywords,
    canonical: m.siteUrl,
    siteName: m.siteName,
    ogImage: m.ogImage,
    ogImageAlt: m.ogImageAlt,
    orgLogoUrl: m.orgLogoUrl,
    orgLogoAlt: m.orgLogoAlt,
    twitterHandle: m.twitterHandle,
  };
}
