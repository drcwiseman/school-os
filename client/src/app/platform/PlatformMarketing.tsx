import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Save, Loader2, BarChart3, Globe } from "lucide-react";
import { api } from "../api/client";
import { useToast } from "../components/Toast";
import { MediaPickerModal, type MediaItem } from "./components/MediaPickerModal";
import { ImageUploadField } from "./components/ImageUploadField";

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

/** Resolve preview src for platform admin (static public files + media API). */
function previewUrl(siteUrl: string, path: string) {
  const p = path?.trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  if (origin && p.startsWith("/")) return `${origin}${p}`;
  const base = siteUrl.replace(/\/$/, "");
  return base ? `${base}${p.startsWith("/") ? p : `/${p}`}` : p;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<"logo" | "og" | null>(null);
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
      toast("Organization logo alt text is required when a logo is set.", "error");
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

  const applyMedia = (target: "logo" | "og", item: MediaItem) => {
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
    toast(`Image set: ${item.fileName}. Click Save marketing settings.`, "success");
  };

  const uploadToLibrary = async (file: File, target: "logo" | "og") => {
    setUploadingTarget(target);
    try {
      const payload = await fileToPayload(file);
      const altFromName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      const res = await api.post("/api/platform/media", {
        ...payload,
        altText: target === "logo"
          ? `${form.siteName || "SchoolOS"} logo`
          : `${form.siteName || "SchoolOS"} — ${altFromName}`,
        title: file.name,
      });
      applyMedia(target, res.data as MediaItem);
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setUploadingTarget(null);
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
          Upload images directly below or manage all files in{" "}
          <Link to="/platform/media" className="text-blue-600 hover:underline">Media Library</Link>.
          Remember to <strong>Save marketing settings</strong> after uploading.
        </p>
      </div>

      <MediaPickerModal
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onSelect={(item) => pickerFor && applyMedia(pickerFor, item)}
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

      <div className={CARD}>
        <ImageUploadField
          label="Organization logo"
          hint="Shown in the public site header and footer. Used in Organization schema for Google."
          url={form.orgLogoUrl}
          alt={form.orgLogoAlt}
          previewSrc={logoPreview}
          uploading={uploadingTarget === "logo"}
          onUrlChange={(v) => set("orgLogoUrl", v)}
          onAltChange={(v) => set("orgLogoAlt", v)}
          onUpload={(f) => uploadToLibrary(f, "logo")}
          onPickLibrary={() => setPickerFor("logo")}
          altRequired={!!form.orgLogoUrl.trim()}
        />
      </div>

      <div className={CARD}>
        <ImageUploadField
          label="Social share image (Open Graph)"
          hint="Recommended 1200×630 PNG or JPG for Facebook and LinkedIn."
          url={form.ogImage}
          alt={form.ogImageAlt}
          previewSrc={ogPreview}
          uploading={uploadingTarget === "og"}
          onUrlChange={(v) => set("ogImage", v)}
          onAltChange={(v) => set("ogImageAlt", v)}
          onUpload={(f) => uploadToLibrary(f, "og")}
          onPickLibrary={() => setPickerFor("og")}
          altRequired={!!form.ogImage.trim()}
        />
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
            placeholder="https://masomobest.com"
            value={form.plausibleDomain}
            onChange={(e) => set("plausibleDomain", e.target.value)}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || uploadingTarget !== null}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <Save size={16} />
        {saving ? "Saving…" : "Save marketing settings"}
      </button>
    </div>
  );
};
