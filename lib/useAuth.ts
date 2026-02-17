"use client";

import { useState, useEffect, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { ref, get, set } from "firebase/database";
import { auth, googleProvider, db } from "./firebase";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

async function checkAndWhitelistEmail(
  email: string
): Promise<{ allowed: boolean }> {
  // Check whitelist first
  const snap = await get(ref(db, "allowedEmails"));
  const existing: string[] = [];
  if (snap.exists()) {
    const data = snap.val();
    if (Array.isArray(data)) {
      existing.push(...data);
    } else {
      existing.push(...(Object.values(data) as string[]));
    }
  }

  if (existing.includes(email)) return { allowed: true };

  // Not on whitelist — check grace period
  const graceSnap = await get(ref(db, "graceUntil"));
  if (graceSnap.exists()) {
    const graceUntil = graceSnap.val() as number;
    if (Date.now() < graceUntil) {
      // Auto-add to whitelist permanently
      existing.push(email);
      await set(ref(db, "allowedEmails"), existing);
      return { allowed: true };
    }
  }

  return { allowed: false };
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Verify email is whitelisted
        try {
          const { allowed } = await checkAndWhitelistEmail(firebaseUser.email ?? "");
          if (!allowed) {
            await firebaseSignOut(auth);
            setUser(null);
            setError("Access denied. Your email is not on the approved list.");
          } else {
            setUser(firebaseUser);
            setError(null);
          }
        } catch {
          // If we can't check (e.g. rules block unauthenticated read),
          // allow the user through — rules will protect the data anyway
          setUser(firebaseUser);
          setError(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      // Fallback to redirect for mobile browsers that block popups
      const code = (err as { code?: string })?.code;
      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user"
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch {
          setError("Sign-in failed. Please try again.");
        }
      } else if (code !== "auth/cancelled-popup-request") {
        setError("Sign-in failed. Please try again.");
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    await firebaseSignOut(auth);
  }, []);

  return { user, loading, error, signIn, signOut };
}
