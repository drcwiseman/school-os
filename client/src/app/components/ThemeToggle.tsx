import React, { useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { applyThemeMode } from "../utils/theme";

export function applyTheme(mode: "light" | "dark") {
  applyThemeMode(mode);
}

export const ThemeToggle: React.FC = () => {
  const [mode, setMode] = React.useState<"light" | "dark">(() =>
    (localStorage.getItem("schoolos_theme") as "light" | "dark") || "dark",
  );

  useEffect(() => { applyThemeMode(mode); }, [mode]);

  return (
    <button type="button" className="btn-ghost text-sm" onClick={() => setMode(mode === "dark" ? "light" : "dark")} title="Toggle theme">
      {mode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};
