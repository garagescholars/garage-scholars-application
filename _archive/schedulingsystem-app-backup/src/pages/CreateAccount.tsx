import React, { useState } from "react";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { addDoc, collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { ADMIN_EMAILS } from "../config";
import { COLLECTIONS } from "../collections";

const CreateAccount: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!auth || !db) {
      setError("Firebase not initialized.");
      return;
    }
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (ADMIN_EMAILS.includes(normalizedEmail)) {
      setError("Admins should log in directly.");
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

      const requestRef = await addDoc(collection(db, "signupRequests"), {
        email: normalizedEmail,
        name: name.trim(),
        roleRequested: "scholar",
        status: "pending",
        createdAt: serverTimestamp()
      });

      await setDoc(doc(db, COLLECTIONS.PROFILES, cred.user.uid), {
        email: normalizedEmail,
        fullName: name.trim(),
        phone: "",
        role: "scholar",
        isActive: false,
        createdAt: serverTimestamp(),
        requestId: requestRef.id
      }, { merge: true });

      await addDoc(collection(db, "adminNotifications"), {
        type: "signup_request",
        requestId: requestRef.id,
        message: `New signup request: ${name.trim()} (${normalizedEmail})`,
        createdAt: serverTimestamp(),
        unread: true
      });

      await signOut(auth);

      setLoading(false);
      navigate("/pending-approval", { replace: true });
    } catch (err) {
      console.error('Account creation error:', err);
      setLoading(false);
      const message = err instanceof Error ? err.message : "Failed to submit request.";
      setError(message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 page-enter">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Create Account</h1>
        <p className="text-sm text-slate-500 mb-6">Submit your request for approval.</p>
        {error && (
          <div className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-600">Full Name</label>
            <input
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Email</label>
            <input
              type="email"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Password</label>
            <input
              type="password"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">Confirm Password</label>
            <input
              type="password"
              className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl"
          >
            {loading ? "Submitting..." : "Request Access"}
          </button>
        </form>
        <button
          onClick={() => navigate("/login")}
          className="mt-4 w-full text-sm text-slate-500"
        >
          Already have an account? Log in.
        </button>
      </div>
    </div>
  );
};

export default CreateAccount;
