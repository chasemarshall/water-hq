"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Turnstile from "react-turnstile";

/**
 * Calls the Turnstile verification endpoint and returns whether the token is valid.
 * Throws on network/parse errors so the caller can fail closed.
 * Exported for unit testing.
 */
export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const res = await fetch("/api/verify-turnstile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const data = await res.json();
  return data.success === true;
}

export function LoginScreen({
  onGoogleSignIn,
  onEmailSignIn,
  error,
}: {
  onGoogleSignIn: () => void;
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  error: string | null;
}) {
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const handleTurnstileSuccess = async (token: string) => {
    setVerifying(true);
    setCaptchaError(null);
    try {
      const success = await verifyTurnstileToken(token);
      setVerified(success);
      if (!success) {
        setCaptchaError("Verification failed. Please refresh and try again.");
      }
    } catch {
      // Fail closed: do not grant access if verification errors
      setVerified(false);
      setCaptchaError("Verification failed. Please refresh and try again.");
    }
    setVerifying(false);
  };

  const handleEmailSignIn = async () => {
    if (!email.trim() || !password.trim()) return;
    setEmailLoading(true);
    try {
      await onEmailSignIn(email.trim(), password.trim());
    } catch (err) {
      console.error("Email sign-in failed", err);
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <motion.div
      className="min-h-dvh flex flex-col items-center justify-center p-6 gap-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="brutal-card bg-surface px-6 py-3 -rotate-2"
        initial={{ y: -40, opacity: 0, rotate: -8 }}
        animate={{ y: 0, opacity: 1, rotate: -2 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
      >
        <span className="font-display text-sm tracking-widest uppercase">
          Hot Water HQ
        </span>
      </motion.div>

      <motion.h1
        className="font-display text-5xl sm:text-6xl text-center leading-none"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 150 }}
      >
        SHOWER
        <br />
        TRACKER
      </motion.h1>

      <motion.p
        className="text-lg font-bold uppercase tracking-wider"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        Family Only
      </motion.p>

      {!verified ? (
        <motion.div
          className="brutal-card bg-surface rounded-2xl p-6 flex flex-col items-center gap-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45, type: "spring", stiffness: 200 }}
        >
          <p className="font-mono text-xs font-bold uppercase tracking-widest">
            Verify to continue
          </p>
          <Turnstile
            sitekey="0x4AAAAAACe1VnSdqdE0AClL"
            onVerify={handleTurnstileSuccess}
            theme="auto"
          />
          {verifying && (
            <p className="font-mono text-sm uppercase tracking-wider animate-pulse">
              Checking...
            </p>
          )}
          {captchaError && (
            <p className="font-mono text-xs font-bold text-coral uppercase tracking-wider text-center">
              {captchaError}
            </p>
          )}
        </motion.div>
      ) : (
        <>
          <div className="w-full max-w-xs flex flex-col gap-3">
            <motion.button
              className="brutal-btn bg-surface w-full py-4 font-display text-xl rounded-xl flex items-center justify-center gap-3"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
              onClick={onGoogleSignIn}
            >
              <svg width="24" height="24" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </motion.button>

              {showEmailForm ? (
              <motion.div
                className="flex flex-col gap-3"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="brutal-input w-full rounded-xl"
                  autoComplete="email"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="brutal-input w-full rounded-xl"
                  autoComplete="current-password"
                  onKeyDown={(e) => { if (e.key === "Enter") handleEmailSignIn(); }}
                />
                <motion.button
                  className="brutal-btn bg-surface w-full py-4 font-display text-xl rounded-xl flex items-center justify-center gap-3"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  onClick={handleEmailSignIn}
                  disabled={emailLoading || !email.trim() || !password.trim()}
                >
                  {emailLoading ? "Signing in..." : "Sign In"}
                </motion.button>
                <button
                  className="font-mono text-xs font-bold uppercase tracking-wider underline self-start"
                  onClick={() => {
                    setShowEmailForm(false);
                    setEmail("");
                    setPassword("");
                  }}
                  type="button"
                >
                  Back
                </button>
              </motion.div>
            ) : (
              <motion.button
                className="brutal-btn bg-surface w-full py-4 font-display text-xl rounded-xl flex items-center justify-center gap-3"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                onClick={() => setShowEmailForm(true)}
              >
                <span aria-hidden>{"\u{1F4E7}"}</span>
                Sign in with Email
              </motion.button>
            )}
          </div>
        </>
      )}

      {error && (
        <motion.div
          className="brutal-card bg-coral text-white px-6 py-4 rounded-xl max-w-xs text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <p className="font-mono text-sm font-bold">{error}</p>
        </motion.div>
      )}

      <motion.div
        className="mt-4 flex gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        {["\u{1F6BF}", "\u{1F512}", "\u{1F4A7}", "\u{1F9FC}"].map((emoji, i) => (
          <span
            key={i}
            className="brutal-card-sm bg-surface w-10 h-10 flex items-center justify-center text-lg rounded-lg"
            style={{ transform: `rotate(${(i - 1.5) * 5}deg)` }}
          >
            {emoji}
          </span>
        ))}
      </motion.div>
    </motion.div>
  );
}
