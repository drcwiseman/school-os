import React, { useRef, useState } from "react";
import { Upload, Images, Loader2 } from "lucide-react";

type Props = {
  label: string;
  hint?: string;
  url: string;
  alt: string;
  previewSrc: string;
  uploading: boolean;
  onUrlChange: (url: string) => void;
  onAltChange: (alt: string) => void;
  onUpload: (file: File) => void;
  onPickLibrary: () => void;
  altRequired?: boolean;
  accept?: string;
};

export const ImageUploadField: React.FC<Props> = ({
  label,
  hint,
  url,
  alt,
  previewSrc,
  uploading,
  onUrlChange,
  onAltChange,
  onUpload,
  onPickLibrary,
  altRequired,
  accept = "image/*,.png,.jpg,.jpeg,.webp,.svg",
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onUpload(file);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-slate-700">{label}</p>
        {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
      </div>

      <div
        className={`rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
          dragOver ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-slate-50/80"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {previewSrc ? (
          <img
            src={previewSrc}
            alt={alt || label}
            className="mx-auto max-h-32 max-w-full object-contain rounded-md mb-3"
          />
        ) : (
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-lg bg-slate-200/60 text-slate-400">
            <Upload size={28} strokeWidth={1.5} />
          </div>
        )}
        <p className="text-sm text-slate-600 mb-3">Drag and drop an image here, or</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? "Uploading…" : "Upload image"}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={onPickLibrary}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Images size={16} />
            Media Library
          </button>
        </div>
        <p className="text-[10px] text-slate-400 mt-3">PNG, JPG, WebP, or SVG · max 10MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-800">
          Advanced: paste image URL manually
        </summary>
        <input
          className="input text-sm mt-2 w-full font-mono"
          placeholder="/api/public/media/…/file or https://…"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
        />
      </details>

      <div>
        <label className="text-xs font-medium text-slate-600">
          Alt text {altRequired && <span className="text-rose-600">*</span>}
        </label>
        <input
          className="input text-sm mt-1 w-full"
          value={alt}
          onChange={(e) => onAltChange(e.target.value)}
          placeholder="Describe this image for SEO and screen readers"
        />
      </div>
    </div>
  );
};
