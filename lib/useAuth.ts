"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  onAuthStateChanged,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  User,
  AuthError,
} from "firebase/auth";
import { ref, get, set } from "firebase/database";
import { auth, googleProvider, db } from "./firebase";

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  sendPhoneCode: (phoneNumber: string) => Promise<void>;
  confirmPhoneCode: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

async function checkAndWhitelistAtPath(
  allowedPath: "allowedEmails" | "allowedPhoneNumbers",
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
  const phoneVerificationIdRef = useRef<string | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  const clearPhoneAuthState = useCallback(() => {
    phoneVerificationIdRef.current = null;
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
      recaptchaVerifierRef.current = null;
    }
  }, []);

  const createPhoneVerifier = useCallback(() => {
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(auth, "phone-recaptcha-container", {
        size: "invisible",
      });
    }
    return recaptchaVerifierRef.current;
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const email = firebaseUser.email ?? "";
          const phoneNumber = firebaseUser.phoneNumber ?? "";
          const check = email
            ? checkAndWhitelistAtPath("allowedEmails", email)
            : phoneNumber
              ? checkAndWhitelistAtPath("allowedPhoneNumbers", phoneNumber)
              : Promise.resolve({ allowed: false });
          const { allowed } = await check;
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

    return () => {
      unsub();
      clearPhoneAuthState();
    };
  }, [clearPhoneAuthState]);

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

  const signOut = useCallback(async () => {
    setError(null);
    await firebaseSignOut(auth);
  }, []);

  const sendPhoneCode = useCallback(async (phoneNumber: string) => {
    setError(null);
    try {
      const verifier = createPhoneVerifier();
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(phoneNumber, verifier);
      phoneVerificationIdRef.current = verificationId;
    } catch (err) {
      const authCode = (err as AuthError)?.code;
      if (authCode === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Could not send code. Check the phone number and try again.");
      }
      clearPhoneAuthState();
      throw err;
    }
  }, [clearPhoneAuthState, createPhoneVerifier]);

  const confirmPhoneCode = useCallback(async (code: string) => {
    setError(null);
    if (!phoneVerificationIdRef.current) {
      setError("Please request a verification code first.");
      throw new Error("Missing verification ID");
    }

    try {
      const credential = PhoneAuthProvider.credential(phoneVerificationIdRef.current, code);
      await signInWithCredential(auth, credential);
      phoneVerificationIdRef.current = null;
    } catch (err) {
      const authCode = (err as AuthError)?.code;
      if (authCode === "auth/code-expired") {
        setError("Verification code expired. Please request a new code.");
      } else if (authCode === "auth/invalid-verification-code") {
        setError("Invalid code. Please re-enter the digits.");
      } else {
        setError("Could not verify code. Please try again.");
      }
      throw err;
    }
  }, []);

  return { user, loading, error, signIn, sendPhoneCode, confirmPhoneCode, signOut };
}
