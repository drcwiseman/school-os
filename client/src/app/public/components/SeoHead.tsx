import React, { useEffect } from "react";

export type SeoProps = {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
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

export const SeoHead: React.FC<SeoProps> = ({ title, description, keywords, canonical, ogImage }) => {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      upsertMeta("description", description);
      upsertMeta("og:description", description, "property");
    }
    if (keywords) upsertMeta("keywords", keywords);
    if (title) upsertMeta("og:title", title, "property");
    if (ogImage) upsertMeta("og:image", ogImage, "property");
    if (canonical) upsertCanonical(canonical);
  }, [title, description, keywords, canonical, ogImage]);

  return null;
};
