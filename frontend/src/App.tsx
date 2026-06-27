import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/AdminPage";
import { AuthPage } from "./pages/AuthPage";
import { ChatPage } from "./pages/ChatPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { ExpiredPage } from "./pages/ExpiredPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { getCurrentUser, getToken } from "./lib/api";
import type { User } from "./types";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;

    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const preference = user?.settings.theme ?? "dark";
    const resolveTheme = () => {
      const systemTheme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
      document.documentElement.dataset.theme = preference === "system" ? systemTheme : preference;
    };

    resolveTheme();
    const media = window.matchMedia("(prefers-color-scheme: light)");
    media.addEventListener("change", resolveTheme);
    return () => media.removeEventListener("change", resolveTheme);
  }, [user?.settings.theme]);

  if (loading) {
    return (
      <div className="grid h-dvh place-items-center bg-ink text-zinc-400">
        Загрузка...
      </div>
    );
  }

  const homePath = user?.role === "admin" ? "/admin" : "/chat";

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={homePath} replace /> : <AuthPage onAuth={setUser} />}
      />
      <Route
        path="/change-password"
        element={user ? <ChangePasswordPage user={user} onUserChange={setUser} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/expired"
        element={user ? <ExpiredPage user={user} onUserChange={setUser} /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/admin"
        element={
          user?.role === "admin" ? (
            <AdminPage user={user} onUserChange={setUser} />
          ) : (
            <Navigate to={user ? "/chat" : "/login"} replace />
          )
        }
      />
      <Route
        path="/settings"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : user.mustChangePassword ? (
            <Navigate to="/change-password" replace />
          ) : (
            <SettingsPage user={user} onUserChange={setUser} />
          )
        }
      />
      <Route
        path="/profile"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : user.mustChangePassword ? (
            <Navigate to="/change-password" replace />
          ) : (
            <ProfilePage user={user} onUserChange={setUser} />
          )
        }
      />
      <Route
        path="/chat"
        element={
          !user ? (
            <Navigate to="/login" replace />
          ) : user.mustChangePassword ? (
            <Navigate to="/change-password" replace />
          ) : (
            <ChatPage user={user} onUserChange={setUser} />
          )
        }
      />
      <Route path="*" element={<Navigate to={user ? homePath : "/login"} replace />} />
    </Routes>
  );
}
