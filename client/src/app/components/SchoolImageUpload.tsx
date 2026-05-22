import React, { useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";

type Props = {
  label: string;
  hint?: string;
  previewSrc: string;
  uploading: boolean;
  disabled?: boolean;
  onUpload: (file: File) => void;
  onClear?: () => void;
};

export const SchoolImageUpload: React.FC<Props> = ({
  label,
  hint,
  previewSrc,
  uploading,
  disabled,
  onUpload,
  onClear,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file?.type.startsWith("image/")) onUpload(file);
  };

  return (
    <div className="space-y-2">
      <div>
        <p className="label mb-0">{label}</p>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>

      <div
        className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          dragOver ? "border-primary-400 bg-primary-950/30" : "border-slate-700 bg-slate-900/40"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {previewSrc ? (
          <div className="relative inline-block mb-3">
            <img
              src={previewSrc}
              alt=""
              className="mx-auto max-h-24 max-w-full object-contain rounded-lg bg-slate-950 p-2"
            />
            {onClear && !disabled && (
              <button
                type="button"
                className="absolute -top-2 -right-2 rounded-full bg-slate-800 border border-slate-600 p-1 text-slate-300 hover:text-white"
                onClick={onClear}
                aria-label="Remove logo"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-lg bg-slate-800 text-slate-500">
            <Upload size={24} strokeWidth={1.5} />
          </div>
        )}
        <p className="text-sm text-slate-400 mb-3">Drag and drop your logo, or</p>
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="btn-primary text-sm inline-flex items-center gap-2"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? "Uploading…" : previewSrc ? "Replace image" : "Upload image"}
        </button>
        <p className="text-[10px] text-slate-500 mt-3">PNG, JPG, or WebP · max 5MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
};

export async function fileToBase64Payload(file: File) {
  const contentBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { fileName: file.name, contentBase64, mimeType: file.type || undefined };
}
