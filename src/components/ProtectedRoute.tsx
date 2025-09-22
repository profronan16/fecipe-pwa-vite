// src/components/ProtectedRoute.tsx
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@contexts/AuthContext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div style={{ padding: 24 }}>Carregando...</div>;
  if (!user) {
    // envia a rota atual para o login
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
