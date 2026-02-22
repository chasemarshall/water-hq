"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LogMap } from "@/lib/types";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

const STINKER_MESSAGES = [
  { emoji: "🦨", title: "YOU STINKER!", body: "You haven't showered in a few days... everything okay over there?" },
  { emoji: "🫣", title: "HMMMM...", body: "It's been a while since your last shower. The water misses you!" },
  { emoji: "💀", title: "YIKES!", body: "3+ days with no shower logged. Your family is concerned." },
  { emoji: "🧅", title: "ONION ALERT!", body: "You're growing layers at this point. Go shower!" },
  { emoji: "🚿", title: "HELLO?!", body: "The shower is literally right there. It's been 3+ days!" },
];

type Message = { emoji: string; title: string; body: string };

interface StinkerPopupProps {
  log: LogMap | null;
  logHistory: LogMap | null;
  currentUser: string;
  getAuthToken: () => Promise<string | null>;
}

export function StinkerPopup({ log, logHistory, currentUser, getAuthToken }: StinkerPopupProps) {
  const [dismissed, setDismissed] = useState(false);
  const [aiMessage, setAiMessage] = useState<Message | null>(null);

  const { shouldShow, daysSince } = useMemo(() => {
    const allEntries = { ...logHistory, ...log };
    if (!allEntries || Object.keys(allEntries).length === 0) return { shouldShow: false, daysSince: 0 };

    const userEntries = Object.values(allEntries).filter(
      (entry) => entry.user === currentUser && entry.endedAt
    );

    if (userEntries.length === 0) return { shouldShow: true, daysSince: 99 };

    const lastShower = Math.max(...userEntries.map((e) => e.endedAt));
    const days = Math.floor((Date.now() - lastShower) / (24 * 60 * 60 * 1000));
    return { shouldShow: Date.now() - lastShower >= THREE_DAYS_MS, daysSince: days };
  }, [log, logHistory, currentUser]);

  // Figure out whether to use a preset or fetch AI
  const { useAi, presetMessage, nextIndex } = useMemo(() => {
    const storageKey = `stinker-index-${currentUser}`;
    try {
      const lastIndex = parseInt(localStorage.getItem(storageKey) ?? "-1", 10);
      const next = lastIndex + 1;
      localStorage.setItem(storageKey, String(next));

      if (next < STINKER_MESSAGES.length) {
        return { useAi: false, presetMessage: STINKER_MESSAGES[next], nextIndex: next };
      }
      return { useAi: true, presetMessage: null, nextIndex: next };
    } catch {
      return { useAi: false, presetMessage: STINKER_MESSAGES[0], nextIndex: 0 };
    }
  }, [currentUser]);

  // Fetch AI-generated message when all presets have been exhausted
  useEffect(() => {
    if (!shouldShow || !useAi) return;

    let cancelled = false;
    (async () => {
      try {
        const token = await getAuthToken();
        if (!token || cancelled) return;

        const res = await fetch("/api/stinker-message", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ user: currentUser, daysSince }),
        });

        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setAiMessage({ emoji: data.emoji, title: data.title, body: data.body });
        }
      } catch {
        // Fall back silently — we'll show a default
      }
    })();

    return () => { cancelled = true; };
  }, [shouldShow, useAi, currentUser, daysSince, getAuthToken]);

  if (!shouldShow || dismissed) return null;

  // Determine what to display
  const message = useAi
    ? aiMessage ?? { emoji: "🦨", title: "SERIOUSLY?!", body: "Go shower already." }
    : presetMessage!;

  // If waiting for AI, show a loading state
  if (useAi && !aiMessage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 modal-backdrop">
        <div className="brutal-card bg-yolk rounded-2xl p-6 max-w-sm w-full text-center">
          <div className="text-5xl mb-3 animate-bounce">🦨</div>
          <p className="font-mono text-sm uppercase tracking-wider">Cooking up a roast...</p>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-6 modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setDismissed(true)}
      >
        <motion.div
          className="brutal-card bg-yolk rounded-2xl p-6 max-w-sm w-full text-center"
          initial={{ scale: 0.5, y: 60, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.8, y: 30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-6xl mb-3">{message.emoji}</div>
          <h2 className="font-display text-2xl uppercase mb-2">{message.title}</h2>
          <p className="font-mono text-sm mb-5">{message.body}</p>
          {useAi && (
            <p className="font-mono text-[10px] text-ink/40 uppercase tracking-wider mb-3">AI generated</p>
          )}
          <button
            className="brutal-btn bg-lime px-6 py-3 rounded-xl font-display uppercase text-sm w-full"
            onClick={() => setDismissed(true)}
          >
            Fine, I&apos;ll shower
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
