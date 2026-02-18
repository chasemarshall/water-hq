"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";
import Turnstile from "react-turnstile";
import { ref, onValue, set, push, remove, query, orderByChild, endAt, get } from "firebase/database";

const USERS = ["Chase", "Livia", "A.J.", "Dad", "Mom"];
const USER_COLORS: Record<string, string> = {
  "Chase": "bg-sky",
  "Livia": "bg-lime",
  "A.J.": "bg-yolk",
  "Dad": "bg-bubblegum",
  "Mom": "bg-mint",
};
const DURATIONS = [15, 20, 30, 45, 60];
const AUTO_RELEASE_SECONDS = 2700;
const MIN_SHOWER_SECONDS = 5;
const USER_STORAGE_KEY = "showerTimerUser";
const SLOT_ALERT_WINDOW_MS = 90_000;
const TEN_MINUTES_MS = 10 * 60 * 1000;

interface ShowerStatus {
  currentUser: string | null;
  startedAt: number | null;
}

interface Slot {
  user: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  recurring?: boolean;
}

interface SlotsMap {
  [key: string]: Slot;
}

interface LogEntry {
  user: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
}

interface LogMap {
  [key: string]: LogEntry;
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatTimeRange(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const start = new Date();
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return `${formatTime(start)} \u2013 ${formatTime(end)}`;
}

function formatElapsed(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function getPersistedUser(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(USER_STORAGE_KEY);
    return saved && USERS.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

function persistUser(name: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(USER_STORAGE_KEY, name);
  } catch {
    // Ignore storage failures (e.g. Safari private mode).
  }
}

function clearPersistedUser() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Ignore storage failures (e.g. Safari private mode).
  }
}

// ============================================================
// USER SELECT SCREEN
// ============================================================
function UserSelectScreen({ onSelect }: { onSelect: (name: string) => void }) {
  const colors = USERS.map((name) => USER_COLORS[name] || "bg-white");

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
        {USERS.map((name, i) => (
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
        {["🚿", "🔥", "💧", "🧼"].map((emoji, i) => (
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

// ============================================================
// STATUS BANNER
// ============================================================
function StatusBanner({
  status,
  currentUser,
  log,
  onAutoRelease,
}: {
  status: ShowerStatus | null;
  currentUser: string;
  log: LogMap | null;
  onAutoRelease: (startedAt: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoReleasedRef = useRef(false);

  const isOccupied = status?.currentUser != null;
  const isMe = status?.currentUser === currentUser;

  const recentShower = !isOccupied && log
    ? Object.values(log).find((entry) => Date.now() - entry.endedAt < 30 * 60 * 1000)
    : null;

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
    if (isMe && elapsed >= AUTO_RELEASE_SECONDS && !autoReleasedRef.current) {
      autoReleasedRef.current = true;
      if (status?.startedAt) onAutoRelease(status.startedAt);
      set(ref(db, "status"), { currentUser: null, startedAt: null });
      if (status?.currentUser) {
        sendPushNotification({
          title: "🚿 SHOWER",
          body: `${status.currentUser} is done`,
          excludeUser: status.currentUser,
        });
      }
    }
  }, [isMe, elapsed]);

  return (
    <motion.div
      className={`brutal-card rounded-2xl p-6 sm:p-8 text-center ${
        isOccupied ? "bg-coral pulse-occupied" : recentShower ? "bg-sky" : "bg-lime"
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
        ) : recentShower ? (
          <>
            <span className="block text-6xl sm:text-7xl mb-2">🧊</span>
            Shower Free
            <span className="block text-sm font-mono font-bold mt-2 uppercase tracking-widest">
              Hot water may be low — {recentShower.user} showered {timeAgo(recentShower.endedAt)}
            </span>
          </>
        ) : (
          <>
            <span className="block text-6xl sm:text-7xl mb-2">🚿</span>
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

// ============================================================
// SHOWER BUTTON
// ============================================================
function ShowerButton({
  status,
  currentUser,
  slots,
  onEnd,
}: {
  status: ShowerStatus | null;
  currentUser: string;
  slots: SlotsMap | null;
  onEnd: (startedAt: number) => void;
}) {
  const isOccupied = status?.currentUser != null;
  const isMe = status?.currentUser === currentUser;
  const canAct = !isOccupied || isMe;
  const [cooldown, setCooldown] = useState(false);

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

  const handleClick = () => {
    if (!canAct || cooldown) return;

    if (isMe) {
      if (status?.startedAt) onEnd(status.startedAt);
      set(ref(db, "status"), { currentUser: null, startedAt: null });
      sendPushNotification({
        title: "🚿 SHOWER",
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

    set(ref(db, "status"), { currentUser, startedAt: Date.now() });
    sendPushNotification({
      title: "🚿 SHOWER",
      body: `${currentUser} started showering`,
      excludeUser: currentUser,
    });
  };

  const label = isMe
    ? cooldown ? "JUST STARTED..." : "I'M DONE"
    : isOccupied
      ? `${status!.currentUser} is in there...`
      : "START SHOWER";

  return (
    <motion.button
      className={`brutal-btn w-full py-6 rounded-2xl font-display text-2xl sm:text-3xl tracking-wide ${
        isMe
          ? cooldown ? "bg-gray-300 text-ink" : "bg-coral text-white"
          : isOccupied
            ? "bg-gray-200 text-ink"
            : "bg-lime text-ink"
      }`}
      disabled={!canAct || cooldown}
      onClick={handleClick}
      whileTap={canAct && !cooldown ? { scale: 0.97 } : undefined}
    >
      {label}
    </motion.button>
  );
}

// ============================================================
// SHOWER LOG (last 24 hours)
// ============================================================
function userColor(name: string): string {
  return USER_COLORS[name] || "bg-white";
}

function formatLogTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min === 0) return `${sec}s`;
  return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function ShowerLog({ log }: { log: LogMap | null }) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  const entries = log
    ? Object.entries(log)
        .filter(([, e]) => e.endedAt > cutoff)
        .sort(([, a], [, b]) => b.endedAt - a.endedAt)
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl uppercase">Shower Log</h2>
        <div className="brutal-card-sm bg-white px-3 py-1 rounded-lg">
          <span className="font-mono text-sm font-bold">
            last 24h
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {entries.length === 0 ? (
            <motion.div
              key="empty-log"
              className="brutal-card-sm bg-white rounded-xl p-6 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <p className="font-mono text-sm text-gray-500 uppercase tracking-wider">
                No showers logged yet
              </p>
              <p className="text-3xl mt-2">🧼</p>
            </motion.div>
          ) : (
            entries.map(([id, entry], i) => (
              <motion.div
                key={id}
                className={`brutal-card-sm bg-white rounded-xl p-4 flex items-center gap-3`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, scale: 0.9 }}
                transition={{ delay: i * 0.03 }}
                layout
              >
                <div
                  className={`${userColor(entry.user)} w-10 h-10 rounded-lg border-2 border-ink flex items-center justify-center font-display text-sm shrink-0`}
                >
                  {entry.user.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-display text-sm block">
                    {entry.user}
                  </span>
                  <span className="font-mono text-xs text-gray-500">
                    {formatLogTime(entry.startedAt)} &mdash; {formatDuration(entry.durationSeconds)}
                  </span>
                </div>
                <div className="font-mono text-xs text-gray-400 shrink-0">
                  {timeAgo(entry.endedAt)}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================================
// TIME SLOTS
// ============================================================
function TimeSlots({
  slots,
  currentUser,
  onClaimClick,
}: {
  slots: SlotsMap | null;
  currentUser: string;
  onClaimClick: () => void;
}) {
  const today = getToday();
  const now = new Date();

  // Group all upcoming slots by date (today + future), including recurring
  const allUpcoming = slots
    ? Object.entries(slots)
        .filter(([, s]) => s.date >= today || s.recurring)
        .sort(([, a], [, b]) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    : [];

  const totalCount = allUpcoming.length;

  // Group by date
  const slotsByDate = new Map<string, [string, Slot][]>();
  for (const entry of allUpcoming) {
    const date = entry[1].recurring ? today : entry[1].date;
    const existing = slotsByDate.get(date) || [];
    existing.push(entry);
    slotsByDate.set(date, existing);
  }

  const sortedDates = [...slotsByDate.keys()].sort();

  const isSlotPast = (slot: Slot) => {
    if (slot.date > today) return false;
    const [h, m] = slot.startTime.split(":").map(Number);
    const end = new Date();
    end.setHours(h, m + slot.durationMinutes, 0, 0);
    return end <= now;
  };

  const formatDateLabel = (dateStr: string) => {
    if (dateStr === today) return "Today";
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    if (dateStr === tomorrowStr) return "Tomorrow";
    const [y, mo, d] = dateStr.split("-").map(Number);
    const date = new Date(y, mo - 1, d);
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  };

  const handleDelete = (id: string) => {
    remove(ref(db, `slots/${id}`));
  };

  let colorIndex = 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl uppercase">Upcoming Slots</h2>
        <div className="brutal-card-sm bg-white px-3 py-1 rounded-lg">
          <span className="font-mono text-sm font-bold">
            {totalCount} booked
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <AnimatePresence mode="popLayout">
          {totalCount === 0 ? (
            <motion.div
              key="empty"
              className="brutal-card-sm bg-white rounded-xl p-6 text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <p className="font-mono text-sm text-gray-500 uppercase tracking-wider">
                No slots claimed yet
              </p>
              <p className="text-3xl mt-2">🫧</p>
            </motion.div>
          ) : (
            sortedDates.map((dateStr) => {
              const dateSlots = slotsByDate.get(dateStr)!;
              return (
                <div key={dateStr}>
                  {(
                    <div className="flex items-center gap-3 my-2">
                      <div className="h-px bg-black/15 flex-1" />
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-gray-500">
                        {formatDateLabel(dateStr)}
                      </span>
                      <div className="h-px bg-black/15 flex-1" />
                    </div>
                  )}
                  {dateSlots.map(([id, slot]) => {
                    const past = isSlotPast(slot);
                    const ci = colorIndex++;
                    return (
                      <motion.div
                        key={id}
                        className={`brutal-card-sm ${userColor(slot.user)} rounded-xl p-4 flex items-center justify-between mb-3${past ? " opacity-50" : ""}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: past ? 0.5 : 1, x: 0 }}
                        exit={{ opacity: 0, x: 20, scale: 0.9 }}
                        transition={{ delay: ci * 0.05 }}
                        layout
                      >
                        <div>
                          <span className="font-display text-base block">
                            {slot.user}
                            {slot.recurring && (
                              <span className="font-mono text-xs ml-2 bg-white/50 px-2 py-0.5 rounded-md">
                                daily
                              </span>
                            )}
                            {past && (
                              <span className="font-mono text-xs ml-2 bg-black/10 px-2 py-0.5 rounded-md">
                                done
                              </span>
                            )}
                          </span>
                          <span className="font-mono text-sm font-bold">
                            {formatTimeRange(slot.startTime, slot.durationMinutes)}
                          </span>
                        </div>
                        {slot.user === currentUser && (
                          <motion.button
                            className="brutal-btn bg-white w-9 h-9 flex items-center justify-center rounded-lg font-bold text-lg"
                            onClick={() => handleDelete(id)}
                            whileTap={{ scale: 0.9 }}
                          >
                            ✕
                          </motion.button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      <motion.button
        className="brutal-btn bg-white w-full py-4 rounded-xl font-display text-lg uppercase tracking-wide"
        onClick={onClaimClick}
        whileTap={{ scale: 0.97 }}
      >
        + Claim a Slot
      </motion.button>
    </div>
  );
}

// ============================================================
// CLAIM MODAL
// ============================================================
function ClaimModal({
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
    }
  }, [isOpen]);

  const handleClaim = () => {
    if (!time || !date) return;

    const [newH, newM] = time.split(":").map(Number);
    const newStart = newH * 60 + newM;
    const newEnd = newStart + duration;

    if (slots) {
      const overlap = Object.values(slots).some((slot) => {
        if (slot.date !== date && !slot.recurring && !recurring) return false;
        if (slot.date !== date && !slot.recurring && recurring) return false;
        if (slot.date === date || slot.recurring || recurring) {
          const [sh, sm] = slot.startTime.split(":").map(Number);
          const sStart = sh * 60 + sm;
          const sEnd = sStart + slot.durationMinutes;
          return newStart < sEnd && newEnd > sStart;
        }
        return false;
      });

      if (overlap) {
        setOverlapError(true);
        return;
      }
    }

    push(ref(db, "slots"), {
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
                  onChange={(e) => { setDate(e.target.value); setOverlapError(false); }}
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
                  onChange={(e) => { setTime(e.target.value); setOverlapError(false); }}
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
                        duration === d ? "bg-lime" : "bg-white"
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
                    recurring ? "bg-lime" : "bg-white"
                  }`}
                  onClick={() => setRecurring(!recurring)}
                >
                  {recurring ? "Repeating Daily ✓" : "Repeat Daily?"}
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pb-2">
              <button
                className="brutal-btn bg-white flex-1 py-4 rounded-xl font-display text-base uppercase"
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

// ============================================================
// TICKER BAR (decorative marquee)
// ============================================================
function TickerBar() {
  const text =
    "ONE SHOWER AT A TIME \u2022 HOT WATER IS PRECIOUS \u2022 RESPECT THE QUEUE \u2022 NO COLD SHOWERS \u2022 ";
  return (
    <div className="brutal-card-sm bg-ink text-paper overflow-hidden rounded-xl py-2 mb-6">
      <div className="marquee whitespace-nowrap font-mono text-xs font-bold uppercase tracking-widest">
        <span>{text.repeat(4)}</span>
      </div>
    </div>
  );
}

// ============================================================
// LOGIN SCREEN
// ============================================================
function LoginScreen({
  onGoogleSignIn,
  onPhoneSendCode,
  onPhoneConfirmCode,
  error,
}: {
  onGoogleSignIn: () => void;
  onPhoneSendCode: (phoneNumber: string) => Promise<void>;
  onPhoneConfirmCode: (code: string) => Promise<void>;
  error: string | null;
}) {
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [phoneStep, setPhoneStep] = useState<"enter-phone" | "enter-code">("enter-phone");
  const [phoneLoading, setPhoneLoading] = useState(false);

  const handleTurnstileSuccess = async (token: string) => {
    setVerifying(true);
    try {
      const res = await fetch("/api/verify-turnstile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      setVerified(data.success === true);
    } catch {
      // Allow through if verification endpoint fails
      setVerified(true);
    }
    setVerifying(false);
  };

  const handleSendPhoneCode = async () => {
    if (!phoneNumber.trim()) return;
    setPhoneLoading(true);
    try {
      await onPhoneSendCode(phoneNumber.trim());
      setPhoneStep("enter-code");
    } catch (err) {
      console.error("Failed to send phone verification code", err);
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleConfirmPhoneCode = async () => {
    if (!code.trim()) return;
    setPhoneLoading(true);
    try {
      await onPhoneConfirmCode(code.trim());
      setCode("");
      setPhoneStep("enter-phone");
    } catch (err) {
      console.error("Failed to confirm phone verification code", err);
    } finally {
      setPhoneLoading(false);
    }
  };

  return (
    <motion.div
      className="min-h-dvh flex flex-col items-center justify-center p-6 gap-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
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
        Family Only
      </motion.p>

      {!verified ? (
        <motion.div
          className="brutal-card bg-white rounded-2xl p-6 flex flex-col items-center gap-4"
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
            theme="light"
          />
          {verifying && (
            <p className="font-mono text-sm uppercase tracking-wider animate-pulse">
              Checking...
            </p>
          )}
        </motion.div>
      ) : (
        <>
          <motion.button
            className="brutal-btn bg-white px-8 py-5 font-display text-xl rounded-xl flex items-center gap-3"
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

          <div id="phone-recaptcha-container" />

          <motion.div
            className="w-full max-w-md flex flex-col gap-3"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            {phoneStep === "enter-phone" ? (
              <>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className="brutal-input w-full rounded-xl"
                  autoComplete="tel"
                />
                <motion.button
                  className="brutal-btn bg-white px-8 py-5 font-display text-xl rounded-xl flex items-center gap-3"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  onClick={handleSendPhoneCode}
                  disabled={phoneLoading || !phoneNumber.trim()}
                >
                  <span aria-hidden>📱</span>
                  {phoneLoading ? "Sending code..." : "Sign in with Phone"}
                </motion.button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="brutal-input w-full rounded-xl"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                />
                <div className="flex gap-2">
                  <motion.button
                    className="brutal-btn bg-white px-8 py-5 font-display text-xl rounded-xl flex items-center gap-3"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    onClick={handleConfirmPhoneCode}
                    disabled={phoneLoading || !code.trim()}
                  >
                    <span aria-hidden>🔐</span>
                    {phoneLoading ? "Verifying..." : "Confirm phone code"}
                  </motion.button>
                  <motion.button
                    className="brutal-btn bg-white px-8 py-5 font-display text-xl rounded-xl flex items-center gap-3"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    onClick={handleSendPhoneCode}
                    disabled={phoneLoading}
                  >
                    <span aria-hidden>🔁</span>
                    {phoneLoading ? "Sending..." : "Resend code"}
                  </motion.button>
                </div>
                <button
                  className="font-mono text-xs font-bold uppercase tracking-wider underline self-start"
                  onClick={() => {
                    setPhoneStep("enter-phone");
                    setCode("");
                  }}
                  type="button"
                >
                  Use a different number
                </button>
              </>
            )}
          </motion.div>
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
        {["🚿", "🔒", "💧", "🧼"].map((emoji, i) => (
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

// ============================================================
// PUSH NOTIFICATION HELPERS
// ============================================================
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush(user: string) {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
    }

    // Store subscription on the server
    await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON(), user }),
    });
  } catch {
    // Push subscription not supported or denied
  }
}

async function sendPushNotification({
  title,
  body,
  excludeUser,
  targetUsers,
}: {
  title: string;
  body: string;
  excludeUser?: string;
  targetUsers?: string[];
}) {
  try {
    await fetch("/api/push-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body, excludeUser, targetUsers }),
    });
  } catch {
    // Ignore send failures
  }
}

function getSlotStartTimestamp(slot: Slot): number {
  const [year, month, day] = slot.date.split("-").map(Number);
  const [hours, minutes] = slot.startTime.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

function getSlotAlertKey(slotId: string, alertType: "owner-ten" | "owner-start" | "others-ten" | "others-start"): string {
  return `${slotId}:${alertType}`;
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function Home() {
  const {
    user: authUser,
    loading: authLoading,
    error: authError,
    signIn,
    sendPhoneCode,
    confirmPhoneCode,
    signOut,
  } = useAuth();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [status, setStatus] = useState<ShowerStatus | null>(null);
  const [slots, setSlots] = useState<SlotsMap | null>(null);
  const [log, setLog] = useState<LogMap | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const sentSlotNotificationsRef = useRef<Set<string>>(new Set());
  const autoLoggedSlotsRef = useRef<Set<string>>(new Set());

  // Request notification permission (called from button tap on iOS, or auto on other browsers)
  const requestNotifPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const result = await Notification.requestPermission();
      setNotifPermission(result);
      if (result === "granted" && currentUser) {
        await subscribeToPush(currentUser);
      }
    } catch {
      // Ignore permission failures.
    }
  }, [currentUser]);

  // Load user from localStorage + register SW + request notification permission
  useEffect(() => {
    const savedUser = getPersistedUser();
    if (savedUser) {
      setCurrentUser(savedUser);
    }
    setLoaded(true);

    // Register service worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Ignore SW registration failures.
      });
    }

    // Check notification permission state
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);

      // Auto-request on non-iOS browsers (iOS requires user gesture)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (!isIOS && Notification.permission === "default") {
        (async () => {
          try {
            const result = await Notification.requestPermission();
            setNotifPermission(result);
            if (result === "granted" && savedUser) {
              await subscribeToPush(savedUser);
            }
          } catch {
            // Ignore permission/subscription failures.
          }
        })();
      } else if (Notification.permission === "granted" && savedUser) {
        subscribeToPush(savedUser);
      }
    }
  }, []);

  // Re-subscribe to push when user changes
  useEffect(() => {
    if (currentUser && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      subscribeToPush(currentUser);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !slots) return;

    const notifyUpcomingSlots = () => {
      const now = Date.now();

      for (const [slotId, slot] of Object.entries(slots)) {
        if (slot.user !== currentUser) continue;

        const slotStartTs = getSlotStartTimestamp(slot);
        const ownerTenDiff = slotStartTs - TEN_MINUTES_MS - now;
        const ownerStartDiff = slotStartTs - now;

        const ownerTenKey = getSlotAlertKey(slotId, "owner-ten");
        if (
          ownerTenDiff >= 0 &&
          ownerTenDiff <= SLOT_ALERT_WINDOW_MS &&
          !sentSlotNotificationsRef.current.has(ownerTenKey)
        ) {
          sendPushNotification({
            title: "🚿 YOUR SHOWER IN 10 MIN",
            body: `Your slot starts at ${formatTimeRange(slot.startTime, slot.durationMinutes)}.`,
            targetUsers: [slot.user],
          });
          sentSlotNotificationsRef.current.add(ownerTenKey);
        }

        const ownerStartKey = getSlotAlertKey(slotId, "owner-start");
        if (
          ownerStartDiff >= 0 &&
          ownerStartDiff <= SLOT_ALERT_WINDOW_MS &&
          !sentSlotNotificationsRef.current.has(ownerStartKey)
        ) {
          sendPushNotification({
            title: "🚿 SHOWER TIME",
            body: `It's time for your shower slot (${formatTimeRange(slot.startTime, slot.durationMinutes)}).`,
            targetUsers: [slot.user],
          });
          sentSlotNotificationsRef.current.add(ownerStartKey);
        }

        const othersTenKey = getSlotAlertKey(slotId, "others-ten");
        if (
          ownerTenDiff >= 0 &&
          ownerTenDiff <= SLOT_ALERT_WINDOW_MS &&
          !sentSlotNotificationsRef.current.has(othersTenKey)
        ) {
          sendPushNotification({
            title: "🚿 Shower Slot Soon",
            body: `${slot.user}'s shower starts in 10 minutes (${formatTimeRange(slot.startTime, slot.durationMinutes)}).`,
            targetUsers: USERS.filter((user) => user !== slot.user),
          });
          sentSlotNotificationsRef.current.add(othersTenKey);
        }

        const othersStartKey = getSlotAlertKey(slotId, "others-start");
        if (
          ownerStartDiff >= 0 &&
          ownerStartDiff <= SLOT_ALERT_WINDOW_MS &&
          !sentSlotNotificationsRef.current.has(othersStartKey)
        ) {
          sendPushNotification({
            title: "🚿 Shower Slot Starting",
            body: `${slot.user}'s shower slot is starting now (${formatTimeRange(slot.startTime, slot.durationMinutes)}).`,
            targetUsers: USERS.filter((user) => user !== slot.user),
          });
          sentSlotNotificationsRef.current.add(othersStartKey);
        }

        // Auto-log shower when slot ends
        const autoLogKey = `${slotId}:auto-log`;
        const slotEndTs = slotStartTs + slot.durationMinutes * 60 * 1000;
        if (
          now >= slotEndTs &&
          now <= slotEndTs + 5 * 60 * 1000 &&
          !autoLoggedSlotsRef.current.has(autoLogKey)
        ) {
          push(ref(db, "log"), {
            user: slot.user,
            startedAt: slotStartTs,
            endedAt: slotEndTs,
            durationSeconds: slot.durationMinutes * 60,
          });
          autoLoggedSlotsRef.current.add(autoLogKey);
        }
      }

      const validKeys = new Set<string>();
      const validAutoLogKeys = new Set<string>();
      for (const [slotId, slot] of Object.entries(slots)) {
        const slotStartTs = getSlotStartTimestamp(slot);
        if (slotStartTs >= now - 5 * 60 * 1000) {
          validKeys.add(getSlotAlertKey(slotId, "owner-ten"));
          validKeys.add(getSlotAlertKey(slotId, "owner-start"));
          validKeys.add(getSlotAlertKey(slotId, "others-ten"));
          validKeys.add(getSlotAlertKey(slotId, "others-start"));
        }
        const slotEndTs = slotStartTs + slot.durationMinutes * 60 * 1000;
        if (slotEndTs >= now - 5 * 60 * 1000) {
          validAutoLogKeys.add(`${slotId}:auto-log`);
        }
      }
      sentSlotNotificationsRef.current = new Set(
        [...sentSlotNotificationsRef.current].filter((key) => validKeys.has(key)),
      );
      autoLoggedSlotsRef.current = new Set(
        [...autoLoggedSlotsRef.current].filter((key) => validAutoLogKeys.has(key)),
      );
    };

    notifyUpcomingSlots();
    const timer = window.setInterval(notifyUpcomingSlots, 30_000);
    return () => window.clearInterval(timer);
  }, [currentUser, slots]);

  // Firebase listeners
  useEffect(() => {
    if (!currentUser) return;

    const statusRef = ref(db, "status");
    const slotsRef = ref(db, "slots");

    const unsubStatus = onValue(statusRef, (snap) => {
      setStatus(snap.val());
    }, () => {
      // Ignore listener errors (e.g. Safari private mode).
    });

    const unsubSlots = onValue(slotsRef, (snap) => {
      setSlots(snap.val());
    }, () => {
      // Ignore listener errors (e.g. Safari private mode).
    });

    const logRef = ref(db, "log");
    const unsubLog = onValue(logRef, (snap) => {
      setLog(snap.val());
    }, () => {
      // Ignore listener errors (e.g. Safari private mode).
    });

    // Cleanup old log entries (older than 24h)
    const cutoff24h = Date.now() - 24 * 60 * 60 * 1000;
    const oldLogQuery = query(
      ref(db, "log"),
      orderByChild("endedAt"),
      endAt(cutoff24h)
    );
    get(oldLogQuery).then((snap) => {
      snap.forEach((child) => {
        remove(child.ref);
      });
    }).catch(() => {
      // Ignore cleanup failures.
    });

    // Cleanup old slots
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    const oldSlotsQuery = query(
      ref(db, "slots"),
      orderByChild("date"),
      endAt(yesterdayStr)
    );
    get(oldSlotsQuery).then((snap) => {
      snap.forEach((child) => {
        remove(child.ref);
      });
    }).catch(() => {
      // Ignore cleanup failures (e.g. Safari private mode).
    });

    return () => {
      unsubStatus();
      unsubSlots();
      unsubLog();
    };
  }, [currentUser]);

  const logShower = useCallback((startedAt: number) => {
    const now = Date.now();
    const durationSeconds = Math.floor((now - startedAt) / 1000);
    if (durationSeconds < 1 || !currentUser) return;
    push(ref(db, "log"), {
      user: currentUser,
      startedAt,
      endedAt: now,
      durationSeconds,
    });
  }, [currentUser]);

  const handleSelectUser = useCallback((name: string) => {
    persistUser(name);
    setCurrentUser(name);
  }, []);

  const handleSwitchUser = useCallback(() => {
    clearPersistedUser();
    setCurrentUser(null);
    setStatus(null);
    setSlots(null);
    setLog(null);
  }, []);

  if (!loaded || authLoading) return null;

  // Not authenticated → show login screen
  if (!authUser) {
    return (
      <main className="max-w-lg mx-auto relative">
        <LoginScreen
          onGoogleSignIn={signIn}
          onPhoneSendCode={sendPhoneCode}
          onPhoneConfirmCode={confirmPhoneCode}
          error={authError}
        />
      </main>
    );
  }

  return (
    <main className="max-w-lg mx-auto relative">
      <AnimatePresence mode="wait">
        {!currentUser ? (
          <UserSelectScreen key="select" onSelect={handleSelectUser} />
        ) : (
          <motion.div
            key="main"
            className="min-h-dvh p-5 flex flex-col gap-6"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
          >
            {/* Header */}
            <motion.header
              className="flex items-center justify-between pt-2"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <button
                className="brutal-btn bg-white px-4 py-2 rounded-xl"
                onClick={handleSwitchUser}
              >
                <span className="font-display text-sm">
                  {currentUser}
                </span>
              </button>
              <button
                className="brutal-btn bg-coral text-white px-4 py-2 rounded-xl font-mono text-sm font-bold uppercase"
                onClick={signOut}
              >
                Sign Out
              </button>
            </motion.header>

            {/* Notification permission banner (iOS needs user gesture) */}
            {notifPermission === "default" && (
              <motion.button
                className="brutal-btn w-full bg-yolk text-ink py-3 rounded-xl font-display text-sm tracking-wide"
                onClick={requestNotifPermission}
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
              >
                Tap to enable notifications
              </motion.button>
            )}

            {/* Decorative ticker */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0.8 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: 0.2 }}
            >
              <TickerBar />
            </motion.div>

            {/* Status */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <StatusBanner status={status} currentUser={currentUser} log={log} onAutoRelease={logShower} />
            </motion.div>

            {/* Shower button */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <ShowerButton
                status={status}
                currentUser={currentUser}
                slots={slots}
                onEnd={logShower}
              />
            </motion.div>

            {/* Shower Log */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              <ShowerLog log={log} />
            </motion.div>

            {/* Divider */}
            <div className="border-t-3 border-ink border-dashed" />

            {/* Time slots */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <TimeSlots
                slots={slots}
                currentUser={currentUser}
                onClaimClick={() => setShowModal(true)}
              />
            </motion.div>

            {/* Footer */}
            <motion.footer
              className="text-center pb-6 mt-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              <p className="font-mono text-xs text-gray-400 uppercase tracking-widest">
                One shower at a time
              </p>
            </motion.footer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Claim Modal */}
      {currentUser && (
        <ClaimModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          currentUser={currentUser}
          slots={slots}
        />
      )}
    </main>
  );
}
