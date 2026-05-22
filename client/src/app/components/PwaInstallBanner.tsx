import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";

export const PwaInstallBanner: React.FC = () => {
  const [prompt, setPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("pwa_dismiss") === "1");

  useEffect(() => {
    const handler = (e: Event) => {
      if (sessionStorage.getItem("pwa_dismiss") === "1") return;
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (dismissed || !prompt) return null;

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-100">
      <span className="flex items-center gap-2"><Download className="w-4 h-4" /> Install SchoolOS for quick access</span>
      <div className="flex gap-2">
        <button type="button" className="btn-primary text-xs py-1" onClick={async () => { await prompt.prompt(); setPrompt(null); }}>Install</button>
        <button type="button" className="btn-ghost text-xs py-1" onClick={() => { sessionStorage.setItem("pwa_dismiss", "1"); setDismissed(true); }}>Dismiss</button>
      </div>
    </div>
  );
};
