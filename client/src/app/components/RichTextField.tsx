import React from "react";
import { EmailRichTextEditor } from "../platform/components/EmailRichTextEditor";
import "../platform/components/email-editor.css";
import "./rich-text-field.css";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Shorter editor for SMS / staff chat / WhatsApp */
  compact?: boolean;
  minHeight?: number;
};

/** Rich text (TipTap) for school messaging — dark theme to match app cards. */
export const RichTextField: React.FC<Props> = ({ value, onChange, placeholder, compact, minHeight }) => {
  const style = minHeight ? ({ ["--rte-min-height" as string]: `${minHeight}px` } as React.CSSProperties) : undefined;
  return (
    <div
      className={`rich-text-field theme-dark${compact ? " compact" : ""}`}
      style={style}
    >
      <EmailRichTextEditor value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
};
