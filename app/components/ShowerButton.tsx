"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { set } from "firebase/database";
import { dbRef } from "@/lib/firebase";
import { MIN_SHOWER_SECONDS } from "@/lib/constants";
import { getToday, isSlotForToday } from "@/lib/utils";
import { sendPushNotification } from "@/lib/notifications";
import type { ShowerStatus, SlotsMap, LogMap } from "@/lib/types";

export function ShowerButton({
  status,
  currentUser,
  slots,
  log,
  onEnd,
}: {
  status: ShowerStatus | null;
  currentUser: string;
  slots: SlotsMap | null;
  log: LogMap | null;
  onEnd: (startedAt: number) => void;
}) {
  const isOccupied = status?.currentUser != null;
  const isMe = status?.currentUser === currentUser;
  const canAct = !isOccupied || isMe;
  const [cooldown, setCooldown] = useState(false);
  const recentShower = !isOccupied && log
    ? Object.values(log).find((entry) => Date.now() - entry.endedAt < 30 * 60 * 1000)
    : null;

  // Enforce minimum shower duration before allowing stop
  useEffect(() => {
    if (!isMe || !status?.startedAt) {
      setCooldown(false);
      return;
    }
    const elapsedSecs = (Date.now() - status.startedAt) / 1000;
    if (elapsedSecs >= MIN_SHOWER_SECONDS) {
      setCooldown(false);
      return;
    }
    setCooldown(true);
    const timer = setTimeout(() => setCooldown(false), (MIN_SHOWER_SECONDS - elapsedSecs) * 1000);
    return () => clearTimeout(timer);
  }, [isMe, status?.startedAt]);

  // Find the active slot for the current user (if their shower overlaps a booked slot)
  const activeSlot = (() => {
    if (!isMe || !slots || !status?.startedAt) return null;
    const now = Date.now();
    for (const [id, slot] of Object.entries(slots)) {
      if (slot.user !== currentUser || !isSlotForToday(slot)) continue;
      const [h, m] = slot.startTime.split(":").map(Number);
      const slotStart = new Date();
      slotStart.setHours(h, m, 0, 0);
      const slotEnd = slotStart.getTime() + slot.durationMinutes * 60 * 1000;
      // Shower started within 10 minutes of slot start through slot end
      if (status.startedAt >= slotStart.getTime() - 10 * 60 * 1000 && now <= slotEnd + 10 * 60 * 1000) {
        return { id, ...slot };
      }
    }
    return null;
  })();

  const handleClick = () => {
    if (!canAct || cooldown) return;

    if (isMe) {
      if (status?.startedAt) onEnd(status.startedAt);
      // Mark the active slot as completed if the user ends their shower early
      if (activeSlot) {
        set(dbRef(`slots/${activeSlot.id}/completed`), true);
      }
      set(dbRef("status"), { currentUser: null, startedAt: null });
      sendPushNotification({
        title: "\u{1F6BF} SHOWER",
        body: `${currentUser} is done`,
        excludeUser: currentUser,
      });
      return;
    }

    // Check for upcoming slots
    if (slots) {
      const now = new Date();
      const today = getToday();
      for (const slot of Object.values(slots)) {
        if (slot.date !== today) continue;
        const [h, m] = slot.startTime.split(":").map(Number);
        const slotStart = new Date();
        slotStart.setHours(h, m, 0, 0);
        const diffMin = (slotStart.getTime() - now.getTime()) / 60000;
        if (diffMin > 0 && diffMin <= 5) {
          alert(
            `Heads up: ${slot.user} has a slot at ${slot.startTime}. Starting anyway.`
          );
          break;
        }
      }
    }

    set(dbRef("status"), { currentUser, startedAt: Date.now() });
    sendPushNotification({
      title: "\u{1F6BF} SHOWER",
      body: `${currentUser} started showering`,
      excludeUser: currentUser,
    });
  };

  const handleExtend = () => {
    if (!activeSlot) return;
    set(dbRef(`slots/${activeSlot.id}/durationMinutes`), activeSlot.durationMinutes + 5);
  };

  const label = isMe
    ? cooldown ? "JUST STARTED..." : "I'M DONE"
    : isOccupied
      ? `${status!.currentUser} is in there...`
      : "START SHOWER";

  const btnClass = `brutal-btn py-6 rounded-2xl font-display text-2xl sm:text-3xl tracking-wide ${
    isMe
      ? cooldown ? "bg-surface text-muted" : "bg-coral text-white"
      : isOccupied
        ? "bg-surface text-muted"
        : recentShower ? "bg-sky text-ink" : "bg-lime text-ink"
  }`;

  if (activeSlot && !cooldown) {
    return (
      <div className="flex gap-2 w-full">
        <motion.button
          className={`${btnClass} flex-1 min-w-0`}
          disabled={!canAct}
          onClick={handleClick}
          whileTap={canAct ? { scale: 0.97 } : undefined}
        >
          {label}
        </motion.button>
        <motion.button
          className="brutal-btn py-6 px-4 rounded-2xl font-display text-xl sm:text-2xl tracking-wide bg-yolk text-ink shrink-0"
          onClick={handleExtend}
          whileTap={{ scale: 0.95 }}
        >
          +5m
        </motion.button>
      </div>
    );
  }

  return (
    <motion.button
      className={`${btnClass} w-full`}
      disabled={!canAct || cooldown}
      onClick={handleClick}
      whileTap={canAct && !cooldown ? { scale: 0.97 } : undefined}
    >
      {label}
    </motion.button>
  );
}
