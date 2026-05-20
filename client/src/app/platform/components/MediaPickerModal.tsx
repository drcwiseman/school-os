import React, { useCallback, useEffect, useState } from "react";
import { Loader2, X, Check } from "lucide-react";
import { api } from "../../api/client";

export type MediaItem = {
  id: string;
  fileName: string;
  mimeType: string;
  url: string;
  altText: string | null;
  title: string | null;
  isImage: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (item: MediaItem, absoluteUrl: string) => void;
  imagesOnly?: boolean;
  siteUrl?: string;
};

function absUrl(siteUrl: string, path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const base = siteUrl.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export const MediaPickerModal: React.FC<Props> = ({
  open,
  onClose,
  onSelect,
  imagesOnly = true,
  siteUrl = "",
}) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = imagesOnly ? "?type=images" : "";
      const res = await api.get(`/api/platform/media${params}`);
      setItems(res.data?.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [imagesOnly]);

  useEffect(() => {
    if (open) {
      setSelected(null);
      load();
    }
  }, [open, load]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-xl shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">Choose from Media Library</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-12">
              No media yet. Upload files in Media Library first.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelected(item)}
                  className={`relative aspect-square rounded-lg border-2 overflow-hidden bg-slate-50 ${
                    selected?.id === item.id ? "border-blue-600 ring-2 ring-blue-200" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {item.isImage ? (
                    <img
                      src={`/api/platform/media/${item.id}/file`}
                      alt={item.altText || item.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="flex items-center justify-center h-full text-[10px] text-slate-500 p-2 text-center break-all">
                      {item.fileName}
                    </span>
                  )}
                  {selected?.id === item.id && (
                    <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                      <Check size={12} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-slate-200 px-4 py-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700">
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              const path = selected.url;
              const full = siteUrl ? absUrl(siteUrl, path) : path;
              onSelect(selected, full);
              onClose();
            }}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Use selected
          </button>
        </div>
      </div>
    </div>
  );
};
