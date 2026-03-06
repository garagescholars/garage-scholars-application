import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.status !== "active") return <Navigate to="/pending-approval" replace />;
  if (profile?.role !== "admin") return <Navigate to="/app" replace />;
  return <>{children}</>;
};

export default AdminRoute;
