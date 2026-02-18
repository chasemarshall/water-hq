"use client";

import { useState, useEffect, useCallback } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
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
  emailSignIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

async function checkAndWhitelistAtPath(
  allowedPath: "allowedEmails",
  value: string
): Promise<{ allowed: boolean }> {
  const snap = await get(ref(db, allowedPath));
  const existing: string[] = [];
  if (snap.exists()) {
    const data = snap.val();
    if (Array.isArray(data)) {
      existing.push(...data);
    } else {
      existing.push(...(Object.values(data) as string[]));
    }
  }

  if (existing.includes(value)) return { allowed: true };

  const graceSnap = await get(ref(db, "graceUntil"));
  if (graceSnap.exists()) {
    const graceUntil = graceSnap.val() as number;
    if (Date.now() < graceUntil) {
      existing.push(value);
      await set(ref(db, allowedPath), existing);
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
        try {
          const email = firebaseUser.email ?? "";
          if (!email) {
            await firebaseSignOut(auth);
            setUser(null);
            setError("Access denied. No email associated with this account.");
            setLoading(false);
            return;
          }
          const { allowed } = await checkAndWhitelistAtPath("allowedEmails", email);
          if (!allowed) {
            await firebaseSignOut(auth);
            setUser(null);
            setError("Access denied. Your account is not on the approved list.");
          } else {
            setUser(firebaseUser);
            setError(null);
          }
        } catch {
          setUser(firebaseUser);
          setError(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const authCode = (err as { code?: string })?.code;
      if (
        authCode === "auth/popup-blocked" ||
        authCode === "auth/popup-closed-by-user"
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch {
          setError("Sign-in failed. Please try again.");
        }
      } else if (authCode !== "auth/cancelled-popup-request") {
        setError("Sign-in failed. Please try again.");
      }
    }
  }, []);

  const emailSignIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const authCode = (err as { code?: string })?.code;
      if (authCode === "auth/user-not-found" || authCode === "auth/invalid-credential") {
        // Account doesn't exist, create it
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (createErr: unknown) {
          const createCode = (createErr as { code?: string })?.code;
          if (createCode === "auth/email-already-in-use") {
            setError("Incorrect password. Please try again.");
          } else if (createCode === "auth/weak-password") {
            setError("Password must be at least 6 characters.");
          } else {
            setError("Sign-in failed. Please try again.");
          }
        }
      } else if (authCode === "auth/wrong-password") {
        setError("Incorrect password. Please try again.");
      } else if (authCode === "auth/invalid-email") {
        setError("Invalid email address.");
      } else if (authCode === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Sign-in failed. Please try again.");
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    await firebaseSignOut(auth);
  }, []);

  return { user, loading, error, signIn, emailSignIn, signOut };
}
