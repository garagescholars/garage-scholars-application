import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import { useAuth } from "../auth/AuthProvider";

const PendingApproval: React.FC = () => {
  const navigate = useNavigate();
  const pendingEmail = localStorage.getItem("pendingEmail");
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile) return;
    if (profile.role === "admin") {
      navigate("/admin", { replace: true });
      return;
    }
    if (profile.status === "active") {
      navigate("/app", { replace: true });
    }
  }, [profile, navigate]);

  const handleBackToLogin = async () => {
    if (auth) await signOut(auth);
    navigate("/login");
  };

  if (!profile || profile.role === "admin" || profile.status === "active") {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Request Submitted</h1>
        <p className="text-sm text-slate-500 mb-4">
          Your account is awaiting admin approval.
        </p>
        {pendingEmail && (
          <div className="text-xs text-slate-500 mb-6">
            {pendingEmail}
          </div>
        )}
        <button
          onClick={handleBackToLogin}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
};

export default PendingApproval;
