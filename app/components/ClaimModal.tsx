"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { push } from "firebase/database";
import { dbRef } from "@/lib/firebase";
import { DURATIONS } from "@/lib/constants";
import { getToday } from "@/lib/utils";
import type { SlotsMap } from "@/lib/types";

export function ClaimModal({
  isOpen,
  onClose,
  currentUser,
  slots,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentUser: string;
  slots: SlotsMap | null;
}) {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState(15);
  const [recurring, setRecurring] = useState(false);
  const [overlapError, setOverlapError] = useState(false);
  const [pastError, setPastError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const min = Math.ceil(now.getMinutes() / 15) * 15;
      now.setMinutes(min, 0, 0);
      if (min >= 60) now.setHours(now.getHours() + 1, 0, 0, 0);
      setTime(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
      );
      setDate(getToday());
      setDuration(15);
      setRecurring(false);
      setOverlapError(false);
      setPastError(false);
    }
  }, [isOpen]);

  const handleClaim = () => {
    if (!time || !date) return;

    const [newH, newM] = time.split(":").map(Number);
    const newStart = newH * 60 + newM;
    const newEnd = newStart + duration;

    // Block booking in the past (unless recurring)
    if (!recurring && date === getToday()) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (newStart < nowMinutes) {
        setPastError(true);
        return;
      }
    }

    if (slots) {
      const overlap = Object.values(slots).some((slot) => {
        // Both recurring, or both on same date — always check overlap
        // One recurring + one specific — only overlap if the specific date matches today
        // (recurring slots repeat daily, so they only conflict with today's one-time slots)
        const bothRecurring = slot.recurring && recurring;
        const sameDate = slot.date === date;
        const recurringVsToday =
          (slot.recurring && !recurring && date === getToday()) ||
          (!slot.recurring && recurring && slot.date === getToday());
        const couldOverlap = sameDate || bothRecurring || recurringVsToday;
        if (!couldOverlap) return false;
        const [sh, sm] = slot.startTime.split(":").map(Number);
        const sStart = sh * 60 + sm;
        const sEnd = sStart + slot.durationMinutes;
        return newStart < sEnd && newEnd > sStart;
      });

      if (overlap) {
        setOverlapError(true);
        return;
      }
    }

    push(dbRef("slots"), {
      user: currentUser,
      date: date,
      startTime: time,
      durationMinutes: duration,
      ...(recurring ? { recurring: true } : {}),
    }).catch((err) => {
      console.error("Failed to save slot:", err);
    });

    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-40 modal-backdrop flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            className="brutal-card bg-paper rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90dvh] p-5 sm:p-6 sm:mx-4"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Overlap error toast */}
            <AnimatePresence>
              {overlapError && (
                <motion.div
                  className="brutal-card-sm bg-coral text-white rounded-xl p-4 mb-4 flex items-center gap-3"
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <span className="text-2xl shrink-0">&#x26A0;&#xFE0F;</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-sm uppercase leading-tight">
                      Time Conflict
                    </p>
                    <p className="font-mono text-xs mt-0.5 opacity-90">
                      This overlaps with an existing slot. Pick a different time.
                    </p>
                  </div>
                  <motion.button
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/20 font-bold text-sm brutal-btn"
                    onClick={() => setOverlapError(false)}
                    whileTap={{ scale: 0.85 }}
                  >
                    &#x2715;
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Past time error toast */}
            <AnimatePresence>
              {pastError && (
                <motion.div
                  className="brutal-card-sm bg-coral text-white rounded-xl p-4 mb-4 flex items-center gap-3"
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <span className="text-2xl shrink-0">&#x23F0;</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-sm uppercase leading-tight">
                      Time Already Passed
                    </p>
                    <p className="font-mono text-xs mt-0.5 opacity-90">
                      Pick a time that hasn&apos;t happened yet.
                    </p>
                  </div>
                  <motion.button
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/20 font-bold text-sm brutal-btn"
                    onClick={() => setPastError(false)}
                    whileTap={{ scale: 0.85 }}
                  >
                    &#x2715;
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            <h3 className="font-display text-2xl uppercase mb-6">
              Claim a Slot
            </h3>

            <div className="flex flex-col gap-5">
              {/* Date */}
              <div>
                <label className="font-mono text-sm font-bold uppercase tracking-wider block mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  min={getToday()}
                  onChange={(e) => { setDate(e.target.value); setOverlapError(false); setPastError(false); }}
                  className="brutal-input w-full rounded-xl"
                />
              </div>

              {/* Start time */}
              <div>
                <label className="font-mono text-sm font-bold uppercase tracking-wider block mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => { setTime(e.target.value); setOverlapError(false); setPastError(false); }}
                  className="brutal-input w-full rounded-xl"
                />
              </div>

              {/* Duration */}
              <div>
                <label className="font-mono text-sm font-bold uppercase tracking-wider block mb-2">
                  Duration
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      className={`brutal-btn py-3 rounded-xl font-mono font-bold text-sm ${
                        duration === d ? "bg-lime" : "bg-surface"
                      }`}
                      onClick={() => { setDuration(d); setOverlapError(false); }}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Recurring toggle */}
              <div>
                <button
                  className={`brutal-btn w-full py-4 rounded-xl font-mono font-bold text-sm uppercase tracking-wider text-center ${
                    recurring ? "bg-lime" : "bg-surface"
                  }`}
                  onClick={() => setRecurring(!recurring)}
                >
                  {recurring ? "Repeating Daily \u2713" : "Repeat Daily?"}
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pb-2">
              <button
                className="brutal-btn bg-surface flex-1 py-4 rounded-xl font-display text-base uppercase"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="brutal-btn bg-lime flex-1 py-4 rounded-xl font-display text-base uppercase"
                onClick={handleClaim}
              >
                Claim It
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
