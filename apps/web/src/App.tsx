import { Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./components/auth/ProtectedRoute.js";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { PricingPage } from "./pages/PricingPage.js";
import { ProbeViewerPage } from "./pages/ProbeViewerPage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { UploadPage } from "./pages/UploadPage.js";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <div className="rounded-lg border border-border-base bg-bg-card px-4 py-3 text-text-secondary">
        {title}
      </div>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Navigate replace to="/login" />} path="/" />
      <Route element={<LoginPage />} path="/login" />
      <Route element={<RegisterPage />} path="/register" />
      <Route element={<ForgotPasswordPage />} path="/forgot-password" />
      <Route
        element={<PlaceholderPage title="Email verification is not implemented yet." />}
        path="/verify-email/:token"
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<UploadPage />} path="/upload" />
        <Route element={<DashboardPage />} path="/dashboard" />
        <Route element={<ProbeViewerPage />} path="/probe" />
        <Route element={<SettingsPage />} path="/settings" />
      </Route>
      <Route element={<PricingPage />} path="/pricing" />
      <Route element={<PlaceholderPage title="This page is not implemented yet." />} path="*" />
    </Routes>
  );
}
