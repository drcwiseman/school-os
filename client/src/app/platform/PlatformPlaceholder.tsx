import React from "react";
import { Link } from "react-router-dom";
import { Construction } from "lucide-react";

export const PlatformPlaceholder: React.FC<{ title: string; hint?: string }> = ({ title, hint }) => (
  <div className="max-w-lg mx-auto py-16 text-center">
    <Construction className="mx-auto text-slate-300 mb-4" size={48} />
    <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
    <p className="mt-2 text-sm text-slate-500">
      {hint ?? "This section is on the roadmap. Core tenant, billing, and audit features are available today."}
    </p>
    <Link to="/platform/dashboard" className="inline-block mt-6 text-sm font-medium text-indigo-600 hover:text-indigo-700">
      ← Back to dashboard
    </Link>
  </div>
);
