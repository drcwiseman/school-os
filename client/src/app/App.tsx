import React from "react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./state/AuthContext";
import { ToastProvider } from "./components/Toast";
import { AppRoutes } from "./routes";

export const App: React.FC = () => {
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
