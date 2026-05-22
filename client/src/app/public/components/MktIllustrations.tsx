import React from "react";
import type { LucideIcon } from "lucide-react";
import { BarChart3, FileText, LayoutDashboard } from "lucide-react";

type IllustrationKind = "analytics" | "automation" | "security" | "academics" | "finance" | "operations" | "hr";

const HERO_CHIPS = [
  { label: "Analytics", icon: BarChart3, pos: "top-6 -right-2 lg:right-0", delay: "0s" },
  { label: "Reports", icon: FileText, pos: "top-1/2 -left-6 lg:-left-10", delay: "0.8s" },
  { label: "Dashboard", icon: LayoutDashboard, pos: "bottom-8 -right-4 lg:right-2", delay: "1.4s" },
] as const;

/** Floating chips around hero — matches theschool-management.com hero accents */
export const HeroFloatingChips: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 hidden md:block">
    {HERO_CHIPS.map((c) => (
      <div
        key={c.label}
        className={`mkt-hero-chip animate-float absolute ${c.pos} animate-chip-pulse`}
        style={{ animationDelay: c.delay }}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-marketing-primary to-marketing-accent text-white">
          <c.icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="font-heading text-sm font-bold text-marketing-navy">{c.label}</span>
      </div>
    ))}
  </div>
);

/** Small scene for “unique offering” cards */
export const OfferingMiniScene: React.FC<{ kind: IllustrationKind }> = ({ kind }) => {
  const base = "relative mx-auto mt-6 h-28 w-full max-w-[200px] overflow-hidden rounded-xl";
  if (kind === "analytics") {
    return (
      <div className={`${base} bg-gradient-to-br from-blue-50 to-indigo-100`}>
        <svg viewBox="0 0 200 112" className="h-full w-full" aria-hidden>
          <rect x="24" y="72" width="20" height="28" rx="4" fill="#4361ee" opacity="0.5" />
          <rect x="54" y="52" width="20" height="48" rx="4" fill="#4361ee" opacity="0.7" />
          <rect x="84" y="36" width="20" height="64" rx="4" fill="#4361ee" />
          <rect x="114" y="48" width="20" height="52" rx="4" fill="#6b84ff" />
          <path d="M34 68 L74 48 L104 40 L134 52" stroke="#2563eb" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <circle cx="134" cy="52" r="5" fill="#2563eb" />
        </svg>
      </div>
    );
  }
  if (kind === "automation") {
    return (
      <div className={`${base} bg-gradient-to-br from-violet-50 to-purple-100`}>
        <svg viewBox="0 0 200 112" className="h-full w-full" aria-hidden>
          <circle cx="60" cy="56" r="22" fill="#8b5cf6" opacity="0.2" />
          <circle cx="100" cy="56" r="22" fill="#8b5cf6" opacity="0.35" />
          <circle cx="140" cy="56" r="22" fill="#7c3aed" opacity="0.5" />
          <path d="M78 56h24M118 56h14" stroke="#6d28d9" strokeWidth="2" strokeLinecap="round" />
          <rect x="44" y="44" width="32" height="24" rx="6" fill="white" stroke="#8b5cf6" strokeWidth="1.5" />
          <rect x="124" y="44" width="32" height="24" rx="6" fill="white" stroke="#7c3aed" strokeWidth="1.5" />
        </svg>
      </div>
    );
  }
  return (
    <div className={`${base} bg-gradient-to-br from-emerald-50 to-teal-100`}>
      <svg viewBox="0 0 200 112" className="h-full w-full" aria-hidden>
        <rect x="50" y="28" width="100" height="56" rx="10" fill="white" stroke="#0d9488" strokeWidth="1.5" />
        <path d="M68 56 L88 72 L128 44" stroke="#0d9488" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="148" cy="36" r="14" fill="#14b8a6" opacity="0.25" />
      </svg>
    </div>
  );
};

/** Role card avatar — illustrated badge */
export const RoleAvatar: React.FC<{ icon: LucideIcon; tone: string }> = ({ icon: Icon, tone }) => (
  <div className={`relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} shadow-lg ring-4 ring-white`}>
    <Icon className="h-9 w-9 text-white" strokeWidth={1.5} />
    <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[10px] font-bold text-marketing-primary shadow">
      ✓
    </span>
  </div>
);

/** Large tab illustration for Features page */
export const FeatureTabScene: React.FC<{ tabId: string }> = ({ tabId }) => {
  const scenes: Record<string, React.ReactNode> = {
    academics: (
      <svg viewBox="0 0 480 360" className="h-full w-full" aria-hidden>
        <rect width="480" height="360" fill="url(#gAcad)" rx="16" />
        <defs>
          <linearGradient id="gAcad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#eef2ff" />
            <stop offset="100%" stopColor="#e0e7ff" />
          </linearGradient>
        </defs>
        <rect x="40" y="48" width="400" height="220" rx="12" fill="white" stroke="#c7d2fe" strokeWidth="1" />
        <rect x="60" y="72" width="120" height="12" rx="4" fill="#4361ee" opacity="0.3" />
        <rect x="60" y="96" width="80" height="8" rx="3" fill="#94a3b8" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={60 + i * 88} y={140} width="72" height="96" rx="8" fill={i === 1 ? "#4361ee" : "#e0e7ff"} opacity={i === 1 ? 1 : 0.6} />
        ))}
        <circle cx="380" cy="100" r="36" fill="#818cf8" opacity="0.2" />
        <rect x="300" y="260" width="120" height="48" rx="10" fill="#4361ee" />
        <rect x="316" y="276" width="88" height="8" rx="3" fill="white" opacity="0.8" />
      </svg>
    ),
    finance: (
      <svg viewBox="0 0 480 360" className="h-full w-full" aria-hidden>
        <rect width="480" height="360" fill="#ecfdf5" rx="16" />
        <rect x="48" y="56" width="384" height="200" rx="14" fill="white" stroke="#a7f3d0" />
        <rect x="72" y="88" width="160" height="24" rx="6" fill="#10b981" opacity="0.15" />
        <rect x="88" y="96" width="100" height="8" rx="3" fill="#059669" opacity="0.6" />
        {[72, 120, 168].map((y, i) => (
          <rect key={y} x={280} y={y} width={120} height="28" rx="6" fill={i === 0 ? "#10b981" : "#d1fae5"} />
        ))}
        <circle cx="120" cy="220" r="48" fill="#10b981" opacity="0.12" />
      </svg>
    ),
    hr: (
      <svg viewBox="0 0 480 360" className="h-full w-full" aria-hidden>
        <rect width="480" height="360" fill="#faf5ff" rx="16" />
        {[[80, 80], [200, 80], [320, 80]].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x + 40} cy={y + 36} r="28" fill="#a78bfa" opacity="0.35" />
            <rect x={x} y={y + 72} width="80" height="100" rx="10" fill="white" stroke="#ddd6fe" />
          </g>
        ))}
      </svg>
    ),
    operations: (
      <svg viewBox="0 0 480 360" className="h-full w-full" aria-hidden>
        <rect width="480" height="360" fill="#fff7ed" rx="16" />
        <rect x="56" y="64" width="160" height="200" rx="12" fill="white" stroke="#fed7aa" />
        <rect x="240" y="64" width="184" height="92" rx="12" fill="#f97316" opacity="0.15" />
        <rect x="240" y="172" width="184" height="92" rx="12" fill="white" stroke="#fdba74" />
        <path d="M120 200 L200 140 L280 200" stroke="#ea580c" strokeWidth="2" fill="none" opacity="0.4" />
      </svg>
    ),
  };
  return (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-marketing-navy/5 bg-white shadow-marketing-lg">
      {scenes[tabId] ?? scenes.academics}
    </div>
  );
};
