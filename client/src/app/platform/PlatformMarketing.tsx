import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Save, Loader2, BarChart3, Globe, ImageIcon, Upload, Images } from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { MediaPickerModal, type MediaItem } from "./components/MediaPickerModal";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm p-5";

type MarketingForm = {
  siteName: string;
  siteUrl: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultKeywords: string;
  orgLogoUrl: string;
  orgLogoAlt: string;
  ogImage: string;
  ogImageAlt: string;
  gaMeasurementId: string;
  gtmContainerId: string;
  plausibleDomain: string;
  twitterHandle: string;
};

const EMPTY: MarketingForm = {
  siteName: "",
  siteUrl: "",
  defaultTitle: "",
  defaultDescription: "",
  defaultKeywords: "",
  orgLogoUrl: "",
  orgLogoAlt: "",
  ogImage: "",
  ogImageAlt: "",
  gaMeasurementId: "",
  gtmContainerId: "",
  plausibleDomain: "",
  twitterHandle: "",
};

function previewUrl(siteUrl: string, path: string) {
  const p = path?.trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  if (p.startsWith("/api/")) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (origin) return `${origin}${p}`;
  }
  const base = siteUrl.replace(/\/$/, "");
  return base ? `${base}${p.startsWith("/") ? p : `/${p}`}` : p;
}

function ImagePreview({ src, alt, label }: { src: string; alt: string; label: string }) {
  if (!src) return null;
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-semibold uppercase text-slate-500 mb-2">{label}</p>
      <img src={src} alt={alt || label} className="max-h-24 max-w-full object-contain rounded" />
      <p className="mt-2 text-[10px] text-slate-500 font-mono break-all">{src}</p>
      {alt && <p className="mt-1 text-[10px] text-slate-600"><span className="font-semibold">alt:</span> {alt}</p>}
    </div>
  );
}

async function fileToPayload(file: File) {
  const contentBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { fileName: file.name, contentBase64, mimeType: file.type || undefined };
}

export const PlatformMarketing: React.FC = () => {
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const ogInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickerFor, setPickerFor] = useState<"logo" | "og" | null>(null);
  const [form, setForm] = useState<MarketingForm>(EMPTY);

  useEffect(() => {
    api.get("/api/platform/settings/marketing")
      .then((r) => setForm({ ...EMPTY, ...r.data }))
      .catch((e) => toast(e.message, "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  const logoPreview = useMemo(
    () => previewUrl(form.siteUrl, form.orgLogoUrl),
    [form.siteUrl, form.orgLogoUrl],
  );
  const ogPreview = useMemo(
    () => previewUrl(form.siteUrl, form.ogImage),
    [form.siteUrl, form.ogImage],
  );

  const save = async () => {
    if (form.orgLogoUrl.trim() && !form.orgLogoAlt.trim()) {
      toast("Organization logo alt text is required when a logo URL is set (SEO & accessibility).", "error");
      return;
    }
    if (form.ogImage.trim() && !form.ogImageAlt.trim()) {
      toast("Open Graph image alt text is required when an OG image is set.", "error");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/api/platform/settings/marketing", form);
      toast("Marketing & SEO saved", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof MarketingForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const applyMedia = (target: "logo" | "og", item: MediaItem, absoluteUrl: string) => {
    const path = item.url;
    if (target === "logo") {
      setForm((f) => ({
        ...f,
        orgLogoUrl: path,
        orgLogoAlt: item.altText?.trim() || f.orgLogoAlt || item.title || "Organization logo",
      }));
    } else {
      setForm((f) => ({
        ...f,
        ogImage: path,
        ogImageAlt: item.altText?.trim() || f.ogImageAlt || item.title || "Social share preview",
      }));
    }
    toast(`Using ${item.fileName}`, "success");
    void absoluteUrl;
  };

  const uploadToLibrary = async (file: File, target: "logo" | "og") => {
    setUploading(true);
    try {
      const payload = await fileToPayload(file);
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      const res = await api.post("/api/platform/media", {
        ...payload,
        altText: target === "logo" ? `${form.siteName || "SchoolOS"} logo` : alt,
        title: file.name,
      });
      const item = res.data as MediaItem;
      applyMedia(target, item, "");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-8">
      <div className={CARD}>
        <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Globe size={20} className="text-blue-600" />
          Marketing, SEO &amp; analytics
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Controls the public marketing site — upload images in{" "}
          <Link to="/platform/media" className="text-blue-600 hover:underline">Media Library</Link>
          , then assign logo &amp; OG image with alt text for SEO.
        </p>
      </div>

      <MediaPickerModal
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onSelect={(item, abs) => pickerFor && applyMedia(pickerFor, item, abs)}
        imagesOnly
        siteUrl={form.siteUrl}
      />

      <div className={`${CARD} space-y-4`}>
        <h2 className="text-sm font-bold text-slate-900">Site identity</h2>
        {[
          { key: "siteName" as const, label: "Brand / organization name" },
          { key: "siteUrl" as const, label: "Public site URL (canonical base)" },
          { key: "defaultTitle" as const, label: "Default page title" },
          { key: "defaultDescription" as const, label: "Meta description" },
          { key: "defaultKeywords" as const, label: "Meta keywords" },
          { key: "twitterHandle" as const, label: "Twitter / X handle" },
        ].map((f) => (
          <div key={f.key}>
            <label className="text-xs font-medium text-slate-600">{f.label}</label>
            <input
              className="input text-sm mt-1 w-full"
              value={form[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className={`${CARD} space-y-4`}>
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ImageIcon size={16} className="text-blue-600" />
          Organization logo (SEO &amp; accessibility)
        </h2>
        <p className="text-xs text-slate-500">
          Used in the public header and footer with proper <code className="text-[10px] bg-slate-100 px-1 rounded">alt</code> text,
          and in JSON-LD <code className="text-[10px] bg-slate-100 px-1 rounded">Organization</code> schema for search engines.
          Use a path like <code className="text-[10px] bg-slate-100 px-1 rounded">/schoolos-logo.svg</code> or a full HTTPS URL.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => logoInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Upload size={12} /> Upload
          </button>
          <button
            type="button"
            onClick={() => setPickerFor("logo")}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
          >
            <Images size={12} /> Media Library
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*,.svg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadToLibrary(f, "logo");
              e.target.value = "";
            }}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Logo URL</label>
          <input
            className="input text-sm mt-1 w-full font-mono"
            placeholder="/api/public/media/…/file"
            value={form.orgLogoUrl}
            onChange={(e) => set("orgLogoUrl", e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">
            Logo alt text <span className="text-rose-600">*</span>
          </label>
          <input
            className="input text-sm mt-1 w-full"
            placeholder="SchoolOS logo — academy management platform for schools"
            value={form.orgLogoAlt}
            onChange={(e) => set("orgLogoAlt", e.target.value)}
          />
          <p className="text-[10px] text-slate-400 mt-1">Describe the logo for screen readers and image SEO (required if logo URL is set).</p>
        </div>
        <ImagePreview src={logoPreview} alt={form.orgLogoAlt} label="Logo preview" />
      </div>

      <div className={`${CARD} space-y-4`}>
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ImageIcon size={16} className="text-emerald-600" />
          Social share image (Open Graph)
        </h2>
        <p className="text-xs text-slate-500">
          Recommended 1200×630 PNG or JPG for Facebook/LinkedIn; SVG works for some crawlers.
          Sets <code className="text-[10px] bg-slate-100 px-1 rounded">og:image</code> and <code className="text-[10px] bg-slate-100 px-1 rounded">og:image:alt</code>.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => ogInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Upload size={12} /> Upload
          </button>
          <button
            type="button"
            onClick={() => setPickerFor("og")}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
          >
            <Images size={12} /> Media Library
          </button>
          <input
            ref={ogInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadToLibrary(f, "og");
              e.target.value = "";
            }}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">OG image URL</label>
          <input
            className="input text-sm mt-1 w-full font-mono"
            placeholder="/api/public/media/…/file"
            value={form.ogImage}
            onChange={(e) => set("ogImage", e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">
            OG image alt text <span className="text-rose-600">*</span>
          </label>
          <input
            className="input text-sm mt-1 w-full"
            placeholder="SchoolOS dashboard preview — school management software"
            value={form.ogImageAlt}
            onChange={(e) => set("ogImageAlt", e.target.value)}
          />
        </div>
        <ImagePreview src={ogPreview} alt={form.ogImageAlt} label="OG preview" />
      </div>

      <div className={`${CARD} space-y-4`}>
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 size={16} className="text-blue-600" />
          Analytics
        </h2>
        <div>
          <label className="text-xs font-medium text-slate-600">Google Analytics 4 measurement ID</label>
          <input
            className="input text-sm mt-1 w-full font-mono"
            placeholder="G-XXXXXXXXXX"
            value={form.gaMeasurementId}
            onChange={(e) => set("gaMeasurementId", e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Google Tag Manager container ID</label>
          <input
            className="input text-sm mt-1 w-full font-mono"
            placeholder="GTM-XXXXXXX"
            value={form.gtmContainerId}
            onChange={(e) => set("gtmContainerId", e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Plausible domain</label>
          <input
            className="input text-sm mt-1 w-full"
            placeholder="school.bclimaxtech.com"
            value={form.plausibleDomain}
            onChange={(e) => set("plausibleDomain", e.target.value)}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <Save size={16} />
        {saving ? "Saving…" : "Save marketing settings"}
      </button>
    </div>
  );
};
