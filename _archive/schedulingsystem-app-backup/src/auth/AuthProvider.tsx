import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ADMIN_EMAILS } from "../config";
import { COLLECTIONS } from "../collections";

type Role = "admin" | "scholar";
type Status = "active" | "disabled" | "pending";

type UserProfile = {
  uid: string;
  email: string;
  name: string;
  role: Role;
  status: Status;
};

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  viewAsUid: string | null;
  setViewAsUid: (uid: string | null) => void;
  effectiveUid: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const setPendingEmail = (email?: string | null) => {
  if (email) localStorage.setItem("pendingEmail", email);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [viewAsUid, setViewAsUid] = useState<string | null>(null);

  useEffect(() => {
    if (!auth || !db) {
      setAuthError("Firebase not initialized.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setProfile(null);
      setAuthError(null);

      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      const email = (firebaseUser.email || "").toLowerCase();
      const isAdminEmail = ADMIN_EMAILS.includes(email);
      const userRef = doc(db, COLLECTIONS.PROFILES, firebaseUser.uid);

      if (isAdminEmail) {
        const name = email.split("@")[0] || "Admin";
        setProfile({
          uid: firebaseUser.uid,
          email,
          name,
          role: "admin",
          status: "active"
        });
        localStorage.removeItem("pendingEmail");
        setLoading(false);
        void setDoc(userRef, {
          email,
          fullName: name,
          role: "admin",
          isActive: true,
          phone: "",
          createdAt: serverTimestamp()
        }, { merge: true }).catch((err) => {
          console.warn("Failed to ensure admin user profile:", err);
        });
        return;
      }

      let userSnap;
      try {
        userSnap = await getDoc(userRef);
      } catch (err) {
        console.warn("Failed to load user profile:", err);
        setAuthError("Unable to load user profile. Please try again.");
        setLoading(false);
        return;
      }

      if (!userSnap.exists()) {
        setPendingEmail(email);
        await signOut(auth);
        setLoading(false);
        return;
      }

      const liveUnsub = onSnapshot(userRef, async (snap) => {
        if (!snap.exists()) {
          setProfile(null);
          return;
        }
        const data = snap.data() as Record<string, any>;
        const role: Role = data.role || "scholar";
        // gs_profiles uses isActive (boolean), map to status string
        const isActive = data.isActive !== false;
        const status: Status = isActive ? "active" : "pending";
        setProfile({
          uid: firebaseUser.uid,
          email: data.email || email,
          name: data.fullName || data.name || firebaseUser.displayName || email.split("@")[0] || "Scholar",
          role,
          status
        });

        if (isActive) {
          localStorage.removeItem("pendingEmail");
        }

        if (!isActive) {
          setPendingEmail(email);
          await signOut(auth);
        }
      });

      setLoading(false);
      return () => liveUnsub();
    });

    return () => unsubscribe();
  }, []);

  const effectiveUid = viewAsUid || user?.uid || null;

  useEffect(() => {
    if (profile?.role !== "admin") {
      setViewAsUid(null);
    }
  }, [profile?.role]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    authError,
    viewAsUid,
    setViewAsUid,
    effectiveUid
  }), [user, profile, loading, authError, viewAsUid, effectiveUid]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
