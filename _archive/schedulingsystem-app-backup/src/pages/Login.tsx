import React, { useEffect, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../auth/AuthProvider";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { profile } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!auth) {
      setError("Firebase not initialized.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      navigate("/app");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.status === "active") {
      navigate("/app");
    }
  }, [profile?.status, navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 page-enter">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Log In</h1>
        <p className="text-sm text-slate-500 mb-6">Access the Scheduling System.</p>
        {error && (
          <div className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Email</label>
            <input
              type="email"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Password</label>
            <input
              type="password"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl"
          >
            {loading ? "Signing in..." : "Log In"}
          </button>
        </form>
        <button
          onClick={() => navigate("/create-account")}
          className="mt-4 w-full text-sm text-slate-500"
        >
          Need access? Request an account.
        </button>
      </div>
    </div>
  );
};

export default Login;
