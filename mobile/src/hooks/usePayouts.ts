import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { COLLECTIONS } from "../constants/collections";
import type { GsPayout, GsStripeAccount } from "../types";

/**
 * Subscribe to a scholar's payout history.
 */
export function usePayouts(scholarId: string | undefined) {
  const [payouts, setPayouts] = useState<GsPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scholarId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.PAYOUTS),
      where("scholarId", "==", scholarId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as GsPayout[];
        setPayouts(items);
        setError(null);
        setLoading(false);
      },
      (err) => {
        console.warn("[usePayouts] Listener error:", err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [scholarId]);

  return { payouts, loading, error };
}

/**
 * Check bank account status for a scholar (direct deposit via Mercury).
 */
export function useBankStatus(userId: string | undefined) {
  const [account, setAccount] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.STRIPE_ACCOUNTS),
      where("userId", "==", userId),
      where("accountType", "==", "scholar")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          setAccount({ id: snap.docs[0].id, ...snap.docs[0].data() });
        } else {
          setAccount(null);
        }
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userId]);

  return {
    account,
    loading,
    bankLinked: account?.payoutsEnabled ?? false,
    bankLast4: account?.bankLast4 ?? null,
    bankAccountType: account?.bankAccountType ?? null,
  };
}

/**
 * @deprecated Use useBankStatus instead. Kept for backward compatibility.
 */
export function useStripeStatus(userId: string | undefined) {
  const [stripeAccount, setStripeAccount] = useState<GsStripeAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.STRIPE_ACCOUNTS),
      where("userId", "==", userId),
      where("accountType", "==", "scholar")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          setStripeAccount({
            id: snap.docs[0].id,
            ...snap.docs[0].data(),
          } as GsStripeAccount);
        } else {
          setStripeAccount(null);
        }
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userId]);

  return {
    stripeAccount,
    loading,
    isOnboarded: stripeAccount?.onboardingComplete ?? false,
    payoutsEnabled: stripeAccount?.payoutsEnabled ?? false,
    bankLast4: stripeAccount?.bankLast4 ?? null,
  };
}
