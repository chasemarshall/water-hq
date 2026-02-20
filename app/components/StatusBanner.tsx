"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { set } from "firebase/database";
import { dbRef } from "@/lib/firebase";
import { AUTO_RELEASE_SECONDS } from "@/lib/constants";
import { formatElapsed, formatTimeRange, timeAgo, isSlotForToday, getEffectiveSlotStartTimestamp, getRecentShower } from "@/lib/utils";
import { sendPushNotification } from "@/lib/notifications";
import type { ShowerStatus, LogMap, SlotsMap } from "@/lib/types";

export function StatusBanner({
  status,
  currentUser,
  log,
  slots,
  onAutoRelease,
}: {
  status: ShowerStatus | null;
  currentUser: string;
  log: LogMap | null;
  slots: SlotsMap | null;
  onAutoRelease: (startedAt: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoReleasedRef = useRef(false);

  const isOccupied = status?.currentUser != null;
  const isMe = status?.currentUser === currentUser;

  const recentShower = !isOccupied ? getRecentShower(log) : null;

  // Find if someone has a slot happening right now
  const activeSlotNow = (() => {
    if (isOccupied || !slots) return null;
    const now = Date.now();
    for (const slot of Object.values(slots)) {
      if (!isSlotForToday(slot) || slot.completed) continue;
      const slotStartMs = getEffectiveSlotStartTimestamp(slot);
      const slotEnd = slotStartMs + slot.durationMinutes * 60 * 1000;
      if (now >= slotStartMs && now <= slotEnd) {
        return slot;
      }
    }
    return null;
  })();

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    autoReleasedRef.current = false;

    if (isOccupied && status?.startedAt) {
      const update = () => {
        const secs = Math.floor((Date.now() - status.startedAt!) / 1000);
        setElapsed(secs);
      };
      update();
      intervalRef.current = setInterval(update, 1000);
    } else {
      setElapsed(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOccupied, status?.startedAt]);

  // Auto-release (fire only once)
  useEffect(() => {
    if (!isMe || elapsed < AUTO_RELEASE_SECONDS || autoReleasedRef.current) return;
    if (!status?.startedAt || !status?.currentUser) return;
    autoReleasedRef.current = true;
    onAutoRelease(status.startedAt);
    set(dbRef("status"), { currentUser: null, startedAt: null });
    sendPushNotification({
      title: "\u{1F6BF} SHOWER",
      body: `${status.currentUser} is done`,
      excludeUser: status.currentUser,
    });
  }, [isMe, elapsed, status, onAutoRelease]);

  return (
    <motion.div
      className={`brutal-card rounded-2xl p-6 sm:p-8 text-center ${
        isOccupied ? "bg-coral pulse-occupied" : activeSlotNow ? "bg-yolk" : recentShower ? "bg-sky" : "bg-lime"
      }`}
      layout
      animate={{ scale: isOccupied ? [1, 1.01, 1] : 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="font-display text-2xl sm:text-3xl uppercase leading-tight">
        {isOccupied ? (
          <>
            <span className="block text-base font-mono font-bold mb-1 uppercase tracking-widest">
              Occupied
            </span>
            {status!.currentUser} is showering
          </>
        ) : activeSlotNow ? (
          <>
            <span className="block text-base font-mono font-bold mb-1 uppercase tracking-widest">
              Reserved
            </span>
            {activeSlotNow.user}&apos;s slot — {formatTimeRange(activeSlotNow.startTime, activeSlotNow.durationMinutes)}
          </>
        ) : recentShower ? (
          <>
            <span className="block text-6xl sm:text-7xl mb-2">{"\u{1F9CA}"}</span>
            Shower Free
            <span className="block text-sm font-mono font-bold mt-2 uppercase tracking-widest">
              Hot water may be low — {recentShower.user} showered {timeAgo(recentShower.endedAt)}
            </span>
          </>
        ) : (
          <>
            <span className="block text-6xl sm:text-7xl mb-2">{"\u{1F6BF}"}</span>
            Shower Free
          </>
        )}
      </div>

      {isOccupied && (
        <motion.div
          className="font-mono text-5xl sm:text-6xl font-bold mt-4 timer-tick"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          {formatElapsed(elapsed)}
        </motion.div>
      )}
    </motion.div>
  );
}
