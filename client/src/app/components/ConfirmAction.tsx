import React from "react";

type Props = {
  label: string;
  confirmMessage: string;
  onConfirm: () => void | Promise<void>;
  variant?: "danger" | "ghost";
  className?: string;
  disabled?: boolean;
};

export const ConfirmAction: React.FC<Props> = ({
  label,
  confirmMessage,
  onConfirm,
  variant = "danger",
  className = "",
  disabled,
}) => {
  const handleClick = async () => {
    if (!window.confirm(confirmMessage)) return;
    await onConfirm();
  };

  const base = variant === "danger"
    ? "text-red-400 hover:text-red-300 border-red-900/40 hover:border-red-800"
    : "";

  return (
    <button
      type="button"
      disabled={disabled}
      className={`btn-ghost text-xs ${base} ${className}`.trim()}
      onClick={handleClick}
    >
      {label}
    </button>
  );
};
