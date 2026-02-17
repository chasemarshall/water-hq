"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";
import Turnstile from "react-turnstile";
import { ref, onValue, set, push, remove, query, orderByChild, endAt, get } from "firebase/database";

const USERS = ["Chase", "Livia", "A.J.", "Dad", "Mom"];
const SLOT_COLORS = ["slot-yolk", "slot-mint", "slot-sky", "slot-bubblegum"];
const DURATIONS = [15, 20, 30, 45, 60];
const AUTO_RELEASE_SECONDS = 2700;
const USER_STORAGE_KEY = "showerTimerUser";

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
  return new Date().toISOString().split("T")[0];
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
  const colors = ["bg-lime", "bg-sky", "bg-yolk", "bg-bubblegum", "bg-mint"];

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
  onAutoRelease,
}: {
  status: ShowerStatus | null;
  currentUser: string;
  onAutoRelease: (startedAt: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const isOccupied = status?.currentUser != null;
  const isMe = status?.currentUser === currentUser;

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

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

  // Auto-release
  useEffect(() => {
    if (isMe && elapsed >= AUTO_RELEASE_SECONDS) {
      if (status?.startedAt) onAutoRelease(status.startedAt);
      set(ref(db, "status"), { currentUser: null, startedAt: null });
    }
  }, [isMe, elapsed]);

  return (
    <motion.div
      className={`brutal-card rounded-2xl p-6 sm:p-8 text-center ${
        isOccupied ? "bg-coral pulse-occupied" : "bg-lime"
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

  const handleClick = () => {
    if (!canAct) return;

    if (isMe) {
      if (status?.startedAt) onEnd(status.startedAt);
      set(ref(db, "status"), { currentUser: null, startedAt: null });
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
  };

  const label = isMe
    ? "I'M DONE"
    : isOccupied
      ? `${status!.currentUser} is in there...`
      : "START SHOWER";

  return (
    <motion.button
      className={`brutal-btn w-full py-6 rounded-2xl font-display text-2xl sm:text-3xl tracking-wide ${
        isMe
          ? "bg-coral text-white"
          : isOccupied
            ? "bg-gray-200 text-ink"
            : "bg-lime text-ink"
      }`}
      disabled={!canAct}
      onClick={handleClick}
      whileTap={canAct ? { scale: 0.97 } : undefined}
    >
      {label}
    </motion.button>
  );
}

// ============================================================
// SHOWER LOG (last 24 hours)
// ============================================================
const LOG_COLORS = ["bg-sky", "bg-yolk", "bg-mint", "bg-bubblegum", "bg-coral"];

function userColor(name: string): string {
  const idx = USERS.indexOf(name);
  return LOG_COLORS[idx >= 0 ? idx % LOG_COLORS.length : 0];
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
                  className={`${userColor(entry.user)} w-10 h-10 rounded-lg brutal-card-sm flex items-center justify-center font-display text-sm shrink-0`}
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

  const todaySlots = slots
    ? Object.entries(slots)
        .filter(([, s]) => s.date === today || s.recurring)
        .filter(([, s]) => {
          const [h, m] = s.startTime.split(":").map(Number);
          const end = new Date();
          end.setHours(h, m + s.durationMinutes, 0, 0);
          return end > now;
        })
        .sort(([, a], [, b]) => a.startTime.localeCompare(b.startTime))
    : [];

  const handleDelete = (id: string) => {
    remove(ref(db, `slots/${id}`));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl uppercase">Today&apos;s Slots</h2>
        <div className="brutal-card-sm bg-white px-3 py-1 rounded-lg">
          <span className="font-mono text-sm font-bold">
            {todaySlots.length} booked
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <AnimatePresence mode="popLayout">
          {todaySlots.length === 0 ? (
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
            todaySlots.map(([id, slot], i) => (
              <motion.div
                key={id}
                className={`brutal-card-sm ${SLOT_COLORS[i % SLOT_COLORS.length]} rounded-xl p-4 flex items-center justify-between`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, scale: 0.9 }}
                transition={{ delay: i * 0.05 }}
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
            ))
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
        alert("This time overlaps with an existing slot. Pick a different time.");
        return;
      }
    }

    push(ref(db, "slots"), {
      user: currentUser,
      date: date,
      startTime: time,
      durationMinutes: duration,
      ...(recurring ? { recurring: true } : {}),
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
                  onChange={(e) => setDate(e.target.value)}
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
                  onChange={(e) => setTime(e.target.value)}
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
                      onClick={() => setDuration(d)}
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
  onSignIn,
  error,
}: {
  onSignIn: () => void;
  error: string | null;
}) {
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

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
        <motion.button
          className="brutal-btn bg-white px-8 py-5 font-display text-xl rounded-xl flex items-center gap-3"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          onClick={onSignIn}
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
// MAIN PAGE
// ============================================================
async function sendNotification(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  // Use service worker notification if available (works when tab is backgrounded)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.active?.postMessage({ type: "SHOW_NOTIFICATION", title, body });
      return;
    } catch {
      // Fall through to basic notification
    }
  }

  try {
    new Notification(title, { body, icon: "/icon" });
  } catch {
    // Safari/iOS may not support Notification constructor
  }
}

export default function Home() {
  const { user: authUser, loading: authLoading, error: authError, signIn, signOut } = useAuth();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [status, setStatus] = useState<ShowerStatus | null>(null);
  const [slots, setSlots] = useState<SlotsMap | null>(null);
  const [log, setLog] = useState<LogMap | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const prevStatusRef = useRef<ShowerStatus | null | undefined>(undefined);

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

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      try {
        void Notification.requestPermission();
      } catch {
        // Ignore permission request failures.
      }
    }
  }, []);

  // Send notifications on status changes
  useEffect(() => {
    // Skip the very first load (prevStatusRef is undefined)
    if (prevStatusRef.current === undefined) {
      prevStatusRef.current = status;
      return;
    }

    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (!currentUser) return;

    // Someone started showering
    if (status?.currentUser && !prev?.currentUser) {
      if (status.currentUser !== currentUser) {
        sendNotification(
          "Shower Occupied 🚿",
          `${status.currentUser} just started showering`
        );
      }
    }

    // Someone finished showering
    if (!status?.currentUser && prev?.currentUser) {
      if (prev.currentUser !== currentUser) {
        sendNotification(
          "Shower Free ✅",
          `${prev.currentUser} is done — shower is free!`
        );
      }
    }
  }, [status, currentUser]);

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
    const yesterdayStr = yesterday.toISOString().split("T")[0];
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
        <LoginScreen onSignIn={signIn} error={authError} />
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
              <StatusBanner status={status} currentUser={currentUser} onAutoRelease={logShower} />
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
