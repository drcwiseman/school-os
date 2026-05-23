import React, { useRef, useState } from "react";
import { Upload, Loader2, X } from "lucide-react";

export { fileToBase64Payload } from "./SchoolImageUpload";

type Props = {
  label: string;
  hint?: string;
  required?: boolean;
  previewSrc: string;
  uploading: boolean;
  disabled?: boolean;
  onUpload: (file: File) => void;
  onClear?: () => void;
};

export const PortalImageUpload: React.FC<Props> = ({
  label,
  hint,
  required,
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
        <p className="portal-panel-title text-sm font-medium mb-0">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </p>
        {hint && <p className="text-xs text-[var(--portal-subtle)] mt-0.5">{hint}</p>}
      </div>

      <div
        className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          dragOver
            ? "border-[var(--portal-accent)] bg-[var(--portal-accent-soft)]"
            : "border-[var(--portal-border)] bg-[var(--portal-bg-muted)]"
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
              className="mx-auto h-24 w-24 rounded-full object-cover border-2 border-[var(--portal-border)]"
            />
            {onClear && !disabled && (
              <button
                type="button"
                className="absolute -top-1 -right-1 rounded-full bg-[var(--portal-bg-elevated)] border border-[var(--portal-border)] p-1 text-[var(--portal-muted)] hover:text-[var(--portal-fg-strong)]"
                onClick={onClear}
                aria-label="Remove photo"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full portal-avatar-fallback">
            <Upload size={24} strokeWidth={1.5} />
          </div>
        )}
        <p className="text-sm text-[var(--portal-muted)] mb-3">
          {required && !previewSrc ? "A profile photo is required" : "Drag and drop a photo, or"}
        </p>
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="portal-btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? "Uploading…" : previewSrc ? "Replace photo" : "Upload photo"}
        </button>
        <p className="text-[10px] text-[var(--portal-subtle)] mt-3">PNG, JPG, or WebP · max 5MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
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
