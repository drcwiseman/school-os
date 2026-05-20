import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LogOut, User } from "lucide-react";

type Admin = { name: string; email: string; role: string };

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "PA").toUpperCase();
}

export const PlatformUserMenu: React.FC<{
  admin: Admin | null;
  onLogout: () => void | Promise<void>;
}> = ({ admin, onLogout }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const name = admin?.name ?? "Platform Admin";
  const roleLabel = admin?.role === "super_admin" ? "Super Admin" : admin?.role ?? "Admin";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 pl-2 border-l border-slate-200 rounded-lg hover:bg-slate-50 pr-1 py-0.5"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm shadow-sm shrink-0">
          {initials(name)}
        </span>
        <span className="hidden sm:block text-left min-w-0">
          <p className="text-sm font-semibold text-slate-700 leading-tight truncate max-w-[140px]">{name}</p>
          <p className="text-[11px] text-slate-500">{roleLabel}</p>
        </span>
        <ChevronDown size={16} className="text-slate-400 hidden sm:block shrink-0" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg z-50"
        >
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
            <p className="text-xs text-slate-500 truncate">{admin?.email}</p>
          </div>
          <Link
            to="/platform/profile"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            <User size={16} className="text-slate-400" />
            Profile &amp; password
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
            onClick={async () => {
              setOpen(false);
              await onLogout();
            }}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};
