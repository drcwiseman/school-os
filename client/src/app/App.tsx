import React, { useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./state/AuthContext";
import { ToastProvider } from "./components/Toast";
import { AppRoutes } from "./routes";
import { applyTheme } from "./components/ThemeToggle";

export const App: React.FC = () => {
  useEffect(() => {
    const saved = (localStorage.getItem("schoolos_theme") as "light" | "dark") || "dark";
    applyTheme(saved);
  }, []);

  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
