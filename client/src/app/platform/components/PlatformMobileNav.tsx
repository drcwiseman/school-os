import React from "react";
import { NavLink } from "react-router-dom";
import { X, Shield } from "lucide-react";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; end?: boolean };
type NavGroup = { label: string; items: NavItem[] };

type Props = {
  open: boolean;
  onClose: () => void;
  groups: NavGroup[];
};

export const PlatformMobileNav: React.FC<Props> = ({ open, onClose, groups }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="Close menu" onClick={onClose} />
      <aside className="absolute left-0 top-0 bottom-0 w-[min(280px,85vw)] bg-[#0f172a] text-slate-300 shadow-xl flex flex-col">
        <div className="shrink-0 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Shield size={18} className="text-blue-400" />
            <span className="font-bold">SchoolOS</span>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X size={22} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3">
          {groups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{group.label}</p>
              <nav className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                          isActive ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800"
                        }`
                      }
                    >
                      <Icon size={16} />
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};
