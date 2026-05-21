import React, { useEffect } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "schoolos_theme";

export function applyTheme(mode: "light" | "dark") {
  document.documentElement.dataset.theme = mode;
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.classList.toggle("light", mode === "light");
  localStorage.setItem(KEY, mode);
}

export const ThemeToggle: React.FC = () => {
  const [mode, setMode] = React.useState<"light" | "dark">(() =>
    (localStorage.getItem(KEY) as "light" | "dark") || "dark",
  );

  useEffect(() => { applyTheme(mode); }, [mode]);

  return (
    <button type="button" className="btn-ghost text-sm" onClick={() => setMode(mode === "dark" ? "light" : "dark")} title="Toggle theme">
      {mode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};
