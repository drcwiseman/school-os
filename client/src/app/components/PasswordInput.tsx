import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { className = "", disabled, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const inputClass = [className, "pr-10"].filter(Boolean).join(" ");

  return (
    <div className="relative w-full">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={inputClass}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 disabled:opacity-40 disabled:pointer-events-none dark:hover:text-slate-200"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
});
