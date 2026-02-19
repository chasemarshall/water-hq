"use client";

import { motion } from "framer-motion";
import { USERS, USER_COLORS } from "@/lib/constants";

export function UserSelectScreen({
  onSelect,
  authEmail,
}: {
  onSelect: (name: string) => void;
  authEmail: string | null;
}) {
  const visibleUsers = USERS.filter((name) => {
    if (name === "Chase") return authEmail === "chasemarshall.f@gmail.com";
    return true;
  });
  const colors = visibleUsers.map((name) => USER_COLORS[name] || "bg-white");

  return (
    <motion.div
      className="min-h-dvh flex flex-col items-center justify-center p-6 gap-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Decorative top sticker */}
      <motion.div
        className="brutal-card bg-white px-6 py-3 -rotate-2"
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
        Who are you?
      </motion.p>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        {visibleUsers.map((name, i) => (
          <motion.button
            key={name}
            className={`brutal-btn ${colors[i % colors.length]} px-8 py-5 font-display text-xl ${i === 3 ? "text-white" : "text-ink"} rounded-xl`}
            initial={{ x: i % 2 === 0 ? -60 : 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 + i * 0.1, type: "spring", stiffness: 200 }}
            onClick={() => onSelect(name)}
          >
            {name}
          </motion.button>
        ))}
      </div>

      {/* Fun bottom decoration */}
      <motion.div
        className="mt-4 flex gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        {["\u{1F6BF}", "\u{1F525}", "\u{1F4A7}", "\u{1F9FC}"].map((emoji, i) => (
          <span
            key={i}
            className="brutal-card-sm bg-white w-10 h-10 flex items-center justify-center text-lg rounded-lg"
            style={{ transform: `rotate(${(i - 1.5) * 5}deg)` }}
          >
            {emoji}
          </span>
        ))}
      </motion.div>
    </motion.div>
  );
}
