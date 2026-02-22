"use client";

import { useState, useMemo } from "react";
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

interface StinkerPopupProps {
  log: LogMap | null;
  logHistory: LogMap | null;
  currentUser: string;
}

export function StinkerPopup({ log, logHistory, currentUser }: StinkerPopupProps) {
  const [dismissed, setDismissed] = useState(false);

  const shouldShow = useMemo(() => {
    // Combine log and logHistory for the fullest picture
    const allEntries = { ...logHistory, ...log };
    if (!allEntries || Object.keys(allEntries).length === 0) return false;

    const userEntries = Object.values(allEntries).filter(
      (entry) => entry.user === currentUser && entry.endedAt
    );

    if (userEntries.length === 0) return true; // No showers ever? Definitely a stinker

    const lastShower = Math.max(...userEntries.map((e) => e.endedAt));
    return Date.now() - lastShower >= THREE_DAYS_MS;
  }, [log, logHistory, currentUser]);

  // Pick a deterministic-ish message based on the user name
  const message = useMemo(() => {
    const index = currentUser.charCodeAt(0) % STINKER_MESSAGES.length;
    return STINKER_MESSAGES[index];
  }, [currentUser]);

  if (!shouldShow || dismissed) return null;

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
