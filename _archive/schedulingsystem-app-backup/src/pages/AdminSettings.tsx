import React, { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ADMIN_EMAILS } from "../config";
import { COLLECTIONS } from "../collections";

const AdminSettings: React.FC = () => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"scholar" | "admin">("scholar");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!auth || !db) {
      setError("Firebase not initialized.");
      return;
    }

    if (!name.trim() || !email.trim() || !password.trim()) {
      setError("All fields are required.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    setLoading(true);
    try {
      // Create the user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const userId = userCredential.user.uid;

      // Create user document in gs_profiles
      await setDoc(doc(db, COLLECTIONS.PROFILES, userId), {
        email: normalizedEmail,
        fullName: name.trim(),
        phone: "",
        role: role,
        isActive: true,
        createdAt: serverTimestamp(),
        createdBy: "admin"
      });

      // If scholar, also create gs_scholarProfiles doc
      if (role === "scholar") {
        await setDoc(doc(db, COLLECTIONS.SCHOLAR_PROFILES, userId), {
          scholarId: userId,
          scholarName: name.trim(),
          monthlyJobGoal: 10,
          monthlyMoneyGoal: 3000,
          totalJobsCompleted: 0,
          totalEarnings: 0,
          payScore: 5.0,
          cancellationRate: 0,
          acceptanceRate: 100,
          tier: "new",
          showOnLeaderboard: true,
          createdAt: serverTimestamp(),
        });
      }

      setSuccess(`User ${name} (${normalizedEmail}) created successfully as ${role}.`);
      setEmail("");
      setName("");
      setPassword("");
      setRole("scholar");
    } catch (err) {
      console.error("Error creating user:", err);
      const message = err instanceof Error ? err.message : "Failed to create user.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 page-enter">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-800">Admin Settings</h1>
          <p className="text-slate-600 mt-1">Manage users and system access.</p>
        </div>

        {/* Create User Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-start gap-3 mb-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-emerald-900 mb-1">Add User Directly</h2>
              <p className="text-sm text-emerald-700">Create a new user account with a username and password you choose. The user will be able to log in immediately.</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              {success}
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Password</label>
                <input
                  type="password"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1">Role</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "scholar" | "admin")}
                >
                  <option value="scholar">Scholar</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              {loading ? "Creating User..." : "Add User"}
            </button>
          </form>
        </div>

        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">User Management Notes:</p>
              <ul className="space-y-1 ml-4 list-disc">
                <li><strong>Scholars</strong> can claim jobs, view their assigned work, and track earnings.</li>
                <li><strong>Admins</strong> can create jobs, manage all users, approve signups, and access all system features.</li>
                <li>Users created here are immediately active and can log in with the credentials you provide.</li>
                <li>Make sure to securely share the password with the new user.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
