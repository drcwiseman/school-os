import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";

/** Optional top offer bar — theschool-management.com style */
export const PromoStrip: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="mkt-promo-strip relative px-4 py-2.5 text-center text-sm font-medium">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2 pr-8">
        <Sparkles className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        <span>
          Launch offer: <strong>20% off</strong> annual plans for new schools — limited time.
        </span>
        <Link
          to="/pricing"
          className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-white/30"
        >
          View pricing
        </Link>
      </div>
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 opacity-80 transition-opacity hover:opacity-100"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss offer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
