import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Images,
  Upload,
  Search,
  RefreshCw,
  Loader2,
  Trash2,
  X,
  Copy,
  Pencil,
} from "lucide-react";
import { api } from "../../api/client";
import { useToast } from "../../components/Toast";

const CARD = "rounded-lg border border-slate-200 bg-white shadow-sm";

type MediaItem = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  altText: string | null;
  title: string | null;
  url: string;
  isImage: boolean;
  uploadedByName: string | null;
  createdAt: string;
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

async function fileToPayload(file: File) {
  const contentBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return {
    fileName: file.name,
    contentBase64,
    mimeType: file.type || undefined,
  };
}

export const PlatformMediaLibrary: React.FC = () => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [summary, setSummary] = useState({ total: 0, images: 0, documents: 0 });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "images" | "documents">("all");
  const [detail, setDetail] = useState<MediaItem | null>(null);
  const [editAlt, setEditAlt] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (search.trim()) params.set("search", search.trim());
      const res = await api.get(`/api/platform/media?${params}`);
      setItems(res.data?.items ?? []);
      setSummary(res.data?.summary ?? { total: 0, images: 0, documents: 0 });
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast, typeFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    let ok = 0;
    for (const file of list) {
      try {
        const payload = await fileToPayload(file);
        const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
        await api.post("/api/platform/media", {
          ...payload,
          altText: alt,
          title: file.name,
        });
        ok += 1;
      } catch (e: any) {
        toast(`${file.name}: ${e.message}`, "error");
      }
    }
    setUploading(false);
    if (ok > 0) {
      toast(ok === 1 ? "File uploaded" : `${ok} files uploaded`, "success");
      load(true);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  };

  const openDetail = (item: MediaItem) => {
    setDetail(item);
    setEditAlt(item.altText ?? "");
    setEditTitle(item.title ?? item.fileName);
  };

  const saveMeta = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await api.patch(`/api/platform/media/${detail.id}`, {
        altText: editAlt,
        title: editTitle,
      });
      setDetail(res.data);
      load(true);
      toast("Media updated", "success");
    } catch (e: any) {
      toast(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this file permanently?")) return;
    try {
      await api.delete(`/api/platform/media/${id}`);
      if (detail?.id === id) setDetail(null);
      toast("Deleted", "success");
      load(true);
    } catch (e: any) {
      toast(e.message, "error");
    }
  };

  const copyUrl = (url: string) => {
    const full = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(full).then(
      () => toast("URL copied", "success"),
      () => toast("Copy failed", "error"),
    );
  };

  const filtered = useMemo(() => items, [items]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-5 pb-8">
      <div className={`${CARD} p-4 sm:p-5`}>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Images size={20} className="text-blue-600" />
              Media Library
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Upload and manage platform images and files — like WordPress Media. Use them in{" "}
              <Link to="/platform/settings/marketing" className="text-blue-600 hover:underline">
                Marketing &amp; SEO
              </Link>{" "}
              for logo, OG image, and more.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => load(true)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.svg"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total loaded", value: summary.total },
          { label: "Images", value: summary.images },
          { label: "Documents", value: summary.documents },
        ].map((s) => (
          <div key={s.label} className={`${CARD} p-3`}>
            <p className="text-[10px] font-semibold uppercase text-slate-500">{s.label}</p>
            <p className="text-lg font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div
        className={`${CARD} p-6 border-dashed ${dragOver ? "border-blue-400 bg-blue-50/50" : "border-slate-300"}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <p className="text-center text-sm text-slate-600">
          Drop files here to upload, or click <strong>Upload files</strong> (max 10MB each — images, PDF, SVG)
        </p>
      </div>

      <div className={`${CARD} p-3 flex flex-wrap gap-2`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input text-sm w-full pl-9"
            placeholder="Search files…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(true)}
          />
        </div>
        <select className="input text-sm w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}>
          <option value="all">All media</option>
          <option value="images">Images only</option>
          <option value="documents">Documents</option>
        </select>
        <button type="button" onClick={() => load(true)} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white">
          Apply
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className={`${CARD} p-12 text-center text-slate-500 text-sm`}>
          No media files yet. Upload your organization logo and marketing images to get started.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`${CARD} overflow-hidden group cursor-pointer hover:ring-2 hover:ring-blue-200 transition-shadow`}
              onClick={() => openDetail(item)}
            >
              <div className="aspect-square bg-slate-100 relative">
                {item.isImage ? (
                  <img
                    src={`/api/platform/media/${item.id}/file`}
                    alt={item.altText || item.fileName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-3 text-center">
                    <span className="text-2xl font-bold text-slate-400 uppercase">{item.fileName.split(".").pop()}</span>
                    <span className="text-[10px] text-slate-500 mt-2 line-clamp-2">{item.fileName}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(item.id); }}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-white/90 text-rose-600 opacity-0 group-hover:opacity-100 shadow-sm hover:bg-white"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="p-2 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-800 truncate" title={item.fileName}>{item.fileName}</p>
                <p className="text-[10px] text-slate-500">{formatBytes(item.sizeBytes)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={() => setDetail(null)} />
          <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-bold text-slate-900 truncate pr-2">Attachment details</h3>
              <button type="button" onClick={() => setDetail(null)} className="p-1 rounded-md hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="rounded-lg border bg-slate-50 overflow-hidden">
                {detail.isImage ? (
                  <img
                    src={`/api/platform/media/${detail.id}/file`}
                    alt={editAlt || detail.fileName}
                    className="w-full max-h-48 object-contain mx-auto"
                  />
                ) : (
                  <p className="p-8 text-center text-sm text-slate-500">{detail.fileName}</p>
                )}
              </div>
              <div className="text-xs space-y-1 text-slate-600">
                <p><span className="font-semibold">File:</span> {detail.fileName}</p>
                <p><span className="font-semibold">Type:</span> {detail.mimeType}</p>
                <p><span className="font-semibold">Size:</span> {formatBytes(detail.sizeBytes)}</p>
                <p><span className="font-semibold">Uploaded:</span> {formatDate(detail.createdAt)}</p>
                {detail.uploadedByName && <p><span className="font-semibold">By:</span> {detail.uploadedByName}</p>}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Title</label>
                <input className="input text-sm w-full mt-1" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Alt text (SEO &amp; accessibility)</label>
                <input className="input text-sm w-full mt-1" value={editAlt} onChange={(e) => setEditAlt(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Public URL</label>
                <div className="flex gap-2 mt-1">
                  <input className="input text-xs flex-1 font-mono" readOnly value={detail.url} />
                  <button type="button" onClick={() => copyUrl(detail.url)} className="shrink-0 p-2 border rounded-md hover:bg-slate-50" title="Copy URL">
                    <Copy size={14} />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Use this path in Marketing settings or paste full URL after copy.</p>
              </div>
              <button
                type="button"
                onClick={saveMeta}
                disabled={saving}
                className="w-full inline-flex items-center justify-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white"
              >
                <Pencil size={14} />
                {saving ? "Saving…" : "Update details"}
              </button>
              <button
                type="button"
                onClick={() => remove(detail.id)}
                className="w-full inline-flex items-center justify-center gap-1 rounded-md border border-rose-200 text-rose-700 px-3 py-2 text-xs font-medium hover:bg-rose-50"
              >
                <Trash2 size={14} />
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
